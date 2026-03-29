/**
 * Google Calendar API の refresh_token を取得するスクリプト
 *
 * ポート 9999 でローカルサーバーを起動し、
 * Google OAuth のリダイレクトを受けて自動で code を処理します。
 *
 * ※ Google Cloud Console の「承認済みリダイレクト URI」に
 *   http://localhost:9999/callback が登録されている必要はありません。
 *   代わりに urn:ietf:wg:oauth:2.0:oob フローを使用します。
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, '../apps/api/.env'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
);

const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/auth/google/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を .env に設定してください');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n=== Google Calendar refresh_token 取得 ===\n');
console.log('【重要】まず factrail を停止してから URL を開いてください:\n');
console.log('  停止: kill $(lsof -ti :3001)\n');
console.log('URL:\n');
console.log(authUrl.toString());
console.log('\n認証後、ブラウザに「このサイトにアクセスできません」と表示されますが正常です。');
console.log('アドレスバーの URL から code= の値をコピーしてください。\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('code を貼り付けてください: ', async (input) => {
  rl.close();

  // URL全体が貼られた場合も対応
  let code = input.trim();
  if (code.includes('code=')) {
    const url = new URL(code.replace(/^.*\?/, 'http://x/?'));
    code = url.searchParams.get('code') || code;
  }

  if (!code) {
    console.error('code が入力されませんでした');
    process.exit(1);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    console.error('\nトークン取得に失敗しました:', tokenData.error, tokenData.error_description);
    process.exit(1);
  }

  console.log('\n=== 取得成功 ===\n');
  console.log('refresh_token:', tokenData.refresh_token);
  console.log('\n以下を .env に追加してください:\n');
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokenData.refresh_token}`);
  console.log('\nfactrail の再起動をお忘れなく！');
  console.log('');
});
