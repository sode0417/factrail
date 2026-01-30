/**
 * 相対時間を日本語でフォーマットする関数
 * @param dateString ISO8601形式の日付文字列
 * @returns 相対時間の日本語表示（例: "2分前", "3時間前", "5日前"）
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  // 未来の日付の場合
  if (diffInSeconds < 0) {
    return '未来';
  }

  // 1分未満
  if (diffInSeconds < 60) {
    return 'たった今';
  }

  // 1時間未満
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}分前`;
  }

  // 1日未満
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}時間前`;
  }

  // 1週間未満
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}日前`;
  }

  // 1ヶ月未満
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks}週間前`;
  }

  // 1年未満
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months}ヶ月前`;
  }

  // 1年以上
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years}年前`;
}
