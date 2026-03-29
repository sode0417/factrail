/**
 * Google Calendar API の refresh_token を取得するスクリプト
 *
 * 使い方:
 *   npx ts-node scripts/get-google-calendar-token.ts
 *
 * 1. 表示される URL をブラウザで開く
 * 2. Google アカウントで認証
 * 3. リダイレクト先の URL から code パラメータをコピー
 * 4. プロンプトに貼り付ける
 * 5. 表示された refresh_token を .env に設定
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/auth/google/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を .env に設定してください');
    process.exit(1);
  }

  // Step 1: 認証 URL を生成
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n=== Google Calendar refresh_token 取得 ===\n');
  console.log('1. 以下の URL をブラウザで開いてください:\n');
  console.log(authUrl.toString());
  console.log('\n2. Google アカウントで認証してください');
  console.log('3. リダイレクト先 URL の "code=" パラメータの値をコピーしてください');
  console.log('   (URL が http://localhost:3001/auth/google/callback?code=XXXXX&scope=... のような形式です)\n');

  // Step 2: code を入力してもらう
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question('code を貼り付けてください: ', (answer) => {
      resolve(answer.trim());
      rl.close();
    });
  });

  if (!code) {
    console.error('code が入力されませんでした');
    process.exit(1);
  }

  // Step 3: code を token に交換
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
  console.log('');
}

main().catch(console.error);
