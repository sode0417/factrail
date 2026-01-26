/**
 * OAuth 2.0 State Parameter Utilities
 *
 * OAuth 2.0のCSRF保護のためのstateパラメータを管理するユーティリティ。
 * RFC 6749, Section 10.12に準拠。
 */

/**
 * OAuth用のランダムなstateパラメータを生成する
 *
 * @returns ランダムなUUID文字列
 */
export const generateOAuthState = (): string => {
  return crypto.randomUUID();
};

/**
 * 生成したstateをsessionStorageに保存する
 *
 * @param provider - プロバイダー名（例: 'slack', 'google'）
 * @param state - 保存するstate値
 */
export const saveOAuthState = (provider: string, state: string): void => {
  sessionStorage.setItem(`${provider}_oauth_state`, state);
};

/**
 * OAuth callbackで受け取ったstateを検証する
 *
 * @param provider - プロバイダー名（例: 'slack', 'google'）
 * @param receivedState - OAuth callbackで受け取ったstate
 * @returns 検証が成功した場合true、失敗した場合false
 *
 * @remarks
 * - 検証後、保存されたstateは自動的に削除される（リプレイ攻撃防止）
 * - 検証失敗時も保存されたstateは削除される
 */
export const validateOAuthState = (
  provider: string,
  receivedState: string | null
): boolean => {
  const storedState = sessionStorage.getItem(`${provider}_oauth_state`);

  // 検証
  const isValid = !!receivedState && !!storedState && receivedState === storedState;

  // 検証後は必ず削除（成功/失敗問わず）
  sessionStorage.removeItem(`${provider}_oauth_state`);

  return isValid;
};

/**
 * 保存されたOAuth stateを手動でクリアする
 *
 * @param provider - プロバイダー名（例: 'slack', 'google'）
 *
 * @remarks
 * 通常はvalidateOAuthStateで自動削除されるため、
 * この関数を直接呼ぶ必要はない。
 * エラーハンドリングやクリーンアップで使用。
 */
export const clearOAuthState = (provider: string): void => {
  sessionStorage.removeItem(`${provider}_oauth_state`);
};

/**
 * OAuth認可URLを構築する際のstateパラメータを準備する
 *
 * @param provider - プロバイダー名（例: 'slack', 'google'）
 * @returns 生成されたstate値
 *
 * @example
 * ```typescript
 * const state = prepareOAuthState('slack');
 * const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&state=${state}&...`;
 * ```
 */
export const prepareOAuthState = (provider: string): string => {
  const state = generateOAuthState();
  saveOAuthState(provider, state);
  return state;
};
