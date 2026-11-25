import { sanitizeVisitUrl } from './url-sanitizer';

describe('sanitizeVisitUrl', () => {
  describe('認証の URL は取り込まない', () => {
    it.each([
      'https://accounts.google.com/signin/oauth/consent?part=secret&rapt=secret',
      'https://accounts.google.com/v3/signin/identifier?continue=https://example.com',
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=secret',
      'https://accounts.google.com/ServiceLogin?rart=secret',
      'https://accounts.google.com/InteractiveLogin?continue=x',
      'http://localhost:58673/callback?code=secret&state=secret',
      'http://127.0.0.1:8080/oauth2callback?code=secret',
      'https://example.com/auth/callback?code=secret',
      'https://github.com/login/oauth/authorize?client_id=x',
      'https://example.com/oauth/token',
      'https://example.com/authorize',
      'https://example.com/LOGIN',
      'https://example.com/login/',
      'https://example.com/login.php',
      'https://example.com/sign-in',
      'https://example.com/users/sign_in',
      'https://example.com/login;jsessionid=secret',
      'https://example.com/%6Cogin?code=secret',
      'https://example.com/a%2Flogin',
      'https://example.com/%E0%A4%A',
      'https://example.com/oauth-callback?code=secret',
      'https://example.com/auth_callback?code=secret',
      'https://example.com/signin-oidc?code=secret',
      'https://example.com/sso/saml?SAMLResponse=secret',
      'https://login.microsoftonline.com/common/saml2?SAMLRequest=secret',
      'https://example.com/reset-password/secret',
      'https://example.com/magic-link/secret',
      'https://hooks.slack.com/services/T000/B000/secret',
      'https://discord.com/api/webhooks/1/secret',
      'https://github.com/session',
      'https://github.com/sessions/two-factor',
      'https://github.com/password_reset/secret',
      'https://github.com/orgs/acme/sso',
      'https://github.com/enterprises/acme/saml/consume',
      'https://github.com/users/foo/emails/1/confirm_verification/secret',
      'https://discordapp.com/api/webhooks/1/secret',
      'https://ptb.discord.com/api/webhooks/1/secret',
      'https://discord.com/api/v10/webhooks/1/secret',
      'https://discord.com//api/webhooks/1/secret',
      'https://discord.com/%61pi/webhooks/1/secret',
      'https://hooks.slack.com./services/T000/B000/secret',
      'https://login.live.com/ppsecure/post.srf',
      'https://login.microsoftonline.com/common/reprocess',
      'https://accounts.google.com/b/0/ServiceLogin',
      'https://accounts.google.com//ServiceLogin',
      'https://accounts.google.com/%53erviceLogin',
      'https://example.com/login%3Bjsessionid=secret',
      'https://example.com/login%20',
      'https://example.com/forgot-password/secret',
      'https://example.com/password/reset/secret',
    ])('%s', (url) => {
      expect(sanitizeVisitUrl(url)).toBeNull();
    });
  });

  describe('http(s) 以外の URL は取り込まない', () => {
    it.each([
      'file:///Users/someone/secret.pdf',
      'data:text/html,token=secret',
      'javascript:alert(1)',
    ])('%s', (url) => {
      expect(sanitizeVisitUrl(url)).toBeNull();
    });
  });

  it('パスの区切りの後ろのパラメータを落とすこと', () => {
    expect(sanitizeVisitUrl('https://example.com/a;jsessionid=secret/b;token=secret')).toBe(
      'https://example.com/a/b',
    );
  });

  describe('GitHub のリポジトリの中は、認証の語があっても取り込む', () => {
    it.each([
      'https://github.com/foo/bar/blob/main/src/login/index.ts',
      'https://github.com/foo/callback/issues/1',
    ])('%s', (url) => {
      expect(sanitizeVisitUrl(url)).toBe(url);
    });
  });

  describe('検索語に貼り付けられた秘密は残さない', () => {
    it.each([
      'https://www.google.com/search?q=https://example.com/reset?token=secret',
      'https://www.google.com/search?q=eyJhbGciOiJIUzI1NiJ9.secret',
      'https://www.google.com/search?q=abcdefghijklmnopqrstuvwxyz0123456789',
      'https://www.google.com/search?q=see+https://x.example/?token=secret',
      'https://www.google.com/search?q=token+eyJhbGciOiJIUzI1NiJ9.abc.def',
      'https://www.google.com/search?q=Bearer+abcdefghijklmnopqrstuvwxyz0123456789',
      'https://www.google.com/search?q=%22https://x.example/?token=secret%22',
      'https://www.google.com/search?q=example.com/reset?token=secret',
      `https://www.google.com/search?q=${'a '.repeat(200)}`,
    ])('%s', (url) => {
      expect(sanitizeVisitUrl(url)).toBe('https://www.google.com/search');
    });
  });

  describe('ふつうの検索語は残す', () => {
    it.each([
      'eyjafjallajokull',
      'spring-boot-starter-data-jpa-reactive-mongodb',
      'org.springframework.boot.autoconfigure.SpringBootApplication',
      'oauth callback とは',
    ])('%s', (query) => {
      const url = sanitizeVisitUrl(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      ) as string;
      expect(new URL(url).searchParams.get('q')).toBe(query);
    });
  });

  describe('動画や記事の ID は、ID の形のときだけ残す', () => {
    it.each([
      [
        'https://www.youtube.com/watch?v=https://x.example/?token=secret',
        'https://www.youtube.com/watch',
      ],
      ['https://www.youtube.com/playlist?list=a%20secret', 'https://www.youtube.com/playlist'],
      ['https://news.ycombinator.com/item?id=secret', 'https://news.ycombinator.com/item'],
    ])('%s', (url, expected) => {
      expect(sanitizeVisitUrl(url)).toBe(expected);
    });
  });

  describe('認証の語を一部に含むだけのパスは取り込む', () => {
    it.each([
      'https://example.com/blog/login-tips',
      'https://example.com/docs/oauth-guide',
      'https://example.com/callbacks',
      'https://example.com/signing',
      'https://accounts.google.com/SignOutOptions',
    ])('%s', (url) => {
      expect(sanitizeVisitUrl(url)).toBe(url);
    });
  });

  it.each([
    'code',
    'state',
    'token',
    'access_token',
    'id_token',
    'rapt',
    'part',
    'api_key',
    'session',
    'password',
  ])('機微なキー %s をクエリから落とすこと', (key) => {
    expect(sanitizeVisitUrl(`https://example.com/page?${key}=secret`)).toBe(
      'https://example.com/page',
    );
  });

  it('知らない名前のキーも既定で落とすこと', () => {
    expect(sanitizeVisitUrl('https://example.com/a?x_custom_auth=secret&utm_source=mail')).toBe(
      'https://example.com/a',
    );
  });

  it('URL の中のユーザー名・パスワードとフラグメントを落とすこと', () => {
    expect(sanitizeVisitUrl('https://user:secret@example.com/a#access_token=secret')).toBe(
      'https://example.com/a',
    );
  });

  describe('検索語と動画の ID は残す', () => {
    it.each([
      [
        'https://www.google.com/search?q=nestjs&oq=nest&sca_esv=secret',
        'https://www.google.com/search?q=nestjs',
      ],
      [
        'https://www.google.co.jp/search?q=%E6%97%A5%E6%9C%AC&ei=secret',
        'https://www.google.co.jp/search?q=%E6%97%A5%E6%9C%AC',
      ],
      ['https://www.bing.com/search?q=rust&form=secret', 'https://www.bing.com/search?q=rust'],
      ['https://cn.bing.com/search?q=rust&form=secret', 'https://cn.bing.com/search?q=rust'],
      [
        'https://www.bing.com/images/search?q=rust&id=1',
        'https://www.bing.com/images/search?q=rust',
      ],
      ['https://www.google.com/search/?q=rust&ei=secret', 'https://www.google.com/search/?q=rust'],
      [
        'https://lite.duckduckgo.com/lite/?q=rust&kl=jp',
        'https://lite.duckduckgo.com/lite/?q=rust',
      ],
      ['https://start.duckduckgo.com/?q=rust&t=secret', 'https://start.duckduckgo.com/?q=rust'],
      [
        'https://www.youtube.com/playlist?list=PL1&si=secret',
        'https://www.youtube.com/playlist?list=PL1',
      ],
      ['https://news.ycombinator.com/item?id=123&p=2', 'https://news.ycombinator.com/item?id=123'],
      ['https://duckduckgo.com/?q=prisma&t=secret', 'https://duckduckgo.com/?q=prisma'],
      [
        'https://html.duckduckgo.com/html/?q=prisma&kl=jp',
        'https://html.duckduckgo.com/html/?q=prisma',
      ],
      [
        'https://www.youtube.com/watch?v=abc123&t=30s&list=secret',
        'https://www.youtube.com/watch?v=abc123',
      ],
    ])('%s', (url, expected) => {
      expect(sanitizeVisitUrl(url)).toBe(expected);
    });
  });

  describe('同じキーでも、決めた画面の外では残さない', () => {
    it.each([
      [
        'https://www.google.com/url?q=https://example.com/?token=secret',
        'https://www.google.com/url',
      ],
      ['https://docs.google.com/document/d/1?q=secret', 'https://docs.google.com/document/d/1'],
      ['https://evil-google.com/search?q=secret', 'https://evil-google.com/search'],
      [
        'https://www.google.com.evil.example/search?q=secret',
        'https://www.google.com.evil.example/search',
      ],
      ['https://example.com/watch?v=secret', 'https://example.com/watch'],
    ])('%s', (url, expected) => {
      expect(sanitizeVisitUrl(url)).toBe(expected);
    });
  });

  it('読めない URL は取り込まないこと', () => {
    expect(sanitizeVisitUrl('not a url?token=secret')).toBeNull();
  });
});
