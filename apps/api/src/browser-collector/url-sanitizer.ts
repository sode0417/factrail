/**
 * Chrome の履歴の URL から、認証の情報を取り除く（#178）。
 *
 * ⭐ 履歴を読んだ直後の 1 か所で通す。ここより後のセッション分割・LLM への入力・Fact の保存は、
 *    すべてこの結果だけを見る。
 * ⭐ クエリは「残すキーを決めて、ほかは全部落とす」形にする。機微なキーの名前を並べる形だと、
 *    知らない名前のトークンが残るため。
 */

/**
 * パスの 1 区切りがこれに一致したら、認証の画面やその戻り先、秘密の入ったリンクとみなす
 * （拡張子は無視する）
 */
const AUTH_PATH_SEGMENT =
  /^(oauth2?|(oauth2?|auth)[-_]?callback|callback|authorize|log[-_]?in|sign[-_]?in|signin[-_]oidc|saml2?|sso|reset[-_]?password|password[-_]?reset|forgot[-_]?password|magic[-_]?link)(\.[a-z0-9]+)?$/i;

/** 区切りをまたぐ、パスワードの再設定のリンク */
const PASSWORD_RESET_PATH = /\/password\/reset(\/|$)/i;

/** accounts.google.com の認証の画面（上の区切りに当たらないもの） */
const GOOGLE_ACCOUNTS_AUTH_PATH = /^\/(b\/\d+\/)?(o\/oauth2|servicelogin|interactivelogin)(\/|$)/i;

/** 開くだけで認証の画面になる、または URL そのものが秘密のホスト */
const AUTH_HOSTS = new Set(['login.microsoftonline.com', 'login.live.com', 'hooks.slack.com']);

const DISCORD_HOST = /^((ptb|canary)\.)?discord(app)?\.com$/;
const DISCORD_WEBHOOK_PATH = /^\/api\/(v\d+\/)?webhooks(\/|$)/i;

/**
 * github.com はパスにリポジトリの中身が並ぶので（src/login/index.ts など）、
 * 認証の画面と決まっている場所だけを除く
 */
const GITHUB_AUTH_FIRST_SEGMENT = new Set(['login', 'session', 'sessions', 'password_reset']);
const GITHUB_AUTH_PATH =
  /^\/((orgs|enterprises)\/[^/]+\/(sso|saml)|users\/[^/]+\/emails\/[^/]+\/confirm_verification)(\/|$)/i;

const GOOGLE_SEARCH_HOST = /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/;
const BING_SEARCH_HOST = /^([a-z]{2}\.|www\.)?bing\.com$/;
const BING_SEARCH_PATH = /^\/((images|videos|news)\/)?search\/?$/;
const DUCKDUCKGO_SEARCH_HOST = /^(www\.|html\.|lite\.|start\.)?duckduckgo\.com$/;
const DUCKDUCKGO_SEARCH_PATH = /^\/((html|lite)\/?)?$/;
const YOUTUBE_HOST = /^(www\.|m\.|music\.)?youtube\.com$/;

/** ⚠️ 下の正規表現は長い入力で遅くなるので、先に長さで切る */
const MAX_SEARCH_QUERY_LENGTH = 256;
const HAS_URL = /[a-z][a-z0-9+.-]*:\/\//i;
const HAS_JWT = /\beyJ[A-Za-z0-9_-]{8,}/;
const HAS_QUERY_PAIR = /[?&][^=\s]+=/;
const LONG_RUN = /[A-Za-z0-9_\-.+/=]{32,}/g;
/** 長い技術用語（spring-boot-starter-... など）と区別するため、切れ目のない長さで見る */
const TOKEN_PART_LENGTH = 24;

const YOUTUBE_ID = /^[\w-]{1,64}$/;
const NUMERIC_ID = /^\d+$/;

/** 検索語に貼り付けられた URL・JWT・長いトークンは、検索語として残さない */
export function isSafeSearchQuery(query: string): boolean {
  if (query.length > MAX_SEARCH_QUERY_LENGTH) return false;
  if (HAS_URL.test(query) || HAS_JWT.test(query) || HAS_QUERY_PAIR.test(query)) return false;
  return !(query.match(LONG_RUN) ?? []).some((run) =>
    run.split(/[-._/]/).some((part) => part.length >= TOKEN_PART_LENGTH),
  );
}

/** パスを、判定できる区切りの並びにする。読めない区切りがあれば null */
function decodePathSegments(pathname: string): string[] | null {
  const segments: string[] = [];
  for (const raw of pathname.split('/')) {
    try {
      segments.push(...decodeURIComponent(raw).split('/'));
    } catch {
      return null;
    }
  }
  return segments.map((segment) => segment.trim()).filter((segment) => segment !== '');
}

function isAuthUrl(parsed: URL): boolean {
  const hostname = parsed.hostname.replace(/\.$/, '');
  if (AUTH_HOSTS.has(hostname)) return true;

  const segments = decodePathSegments(parsed.pathname);
  if (segments === null) return true; // 中身を確かめられないので取り込まない
  const path = `/${segments.join('/')}`;

  if (hostname === 'accounts.google.com' && GOOGLE_ACCOUNTS_AUTH_PATH.test(path)) return true;
  if (DISCORD_HOST.test(hostname) && DISCORD_WEBHOOK_PATH.test(path)) return true;

  if (hostname === 'github.com') {
    return (
      GITHUB_AUTH_FIRST_SEGMENT.has((segments[0] ?? '').toLowerCase()) ||
      GITHUB_AUTH_PATH.test(path)
    );
  }
  return PASSWORD_RESET_PATH.test(path) || segments.some((s) => AUTH_PATH_SEGMENT.test(s));
}

interface AllowedParam {
  key: string;
  isSafe: (value: string) => boolean;
}

/**
 * この URL で残してよいクエリのキーと、値の条件。
 * ⚠️ 検索の q はセッション分割が検索語として読むので残す。検索の結果の画面だけに絞るのは、
 *    google.com/url?q=... の q には飛び先の URL がそのまま入るため。
 */
function allowedParam(parsed: URL): AllowedParam | null {
  const { hostname, pathname } = parsed;
  const search = { key: 'q', isSafe: isSafeSearchQuery };
  if (GOOGLE_SEARCH_HOST.test(hostname) && /^\/search\/?$/.test(pathname)) return search;
  if (BING_SEARCH_HOST.test(hostname) && BING_SEARCH_PATH.test(pathname)) return search;
  if (DUCKDUCKGO_SEARCH_HOST.test(hostname) && DUCKDUCKGO_SEARCH_PATH.test(pathname)) return search;

  const matches = (id: RegExp) => (value: string) => id.test(value);
  if (YOUTUBE_HOST.test(hostname) && pathname === '/watch') {
    return { key: 'v', isSafe: matches(YOUTUBE_ID) };
  }
  if (YOUTUBE_HOST.test(hostname) && pathname === '/playlist') {
    return { key: 'list', isSafe: matches(YOUTUBE_ID) };
  }
  if (hostname === 'news.ycombinator.com' && pathname === '/item') {
    return { key: 'id', isSafe: matches(NUMERIC_ID) };
  }
  return null;
}

/**
 * 保存してよい形の URL を返す。取り込まない URL は null を返す。
 * 読めない URL と http(s) 以外の URL は、中身を確かめられないので取り込まない。
 */
export function sanitizeVisitUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // /app;jsessionid=... のように、パスの区切りの後ろにも秘密が入ることがある
  parsed.pathname = parsed.pathname
    .split('/')
    .map((segment) => segment.split(/;|%3B/i)[0])
    .join('/');

  if (isAuthUrl(parsed)) return null;

  const kept = new URLSearchParams();
  const allowed = allowedParam(parsed);
  if (allowed) {
    for (const value of parsed.searchParams.getAll(allowed.key)) {
      if (allowed.isSafe(value.trim())) kept.append(allowed.key, value);
    }
  }

  parsed.search = kept.toString();
  parsed.hash = ''; // #access_token=... のように、トークンが入ることがある
  parsed.username = '';
  parsed.password = '';
  return parsed.toString();
}
