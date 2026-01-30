/**
 * 相対時間を日本語でフォーマットする関数
 * @param dateString ISO8601形式の日時文字列
 * @returns 相対時間の文字列（例: "たった今", "2分前", "3時間前"）
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 10) {
    return 'たった今';
  } else if (diffSeconds < 60) {
    return `${diffSeconds}秒前`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}週間前`;
  } else if (diffMonths < 12) {
    return `${diffMonths}ヶ月前`;
  } else {
    return `${diffYears}年前`;
  }
}
