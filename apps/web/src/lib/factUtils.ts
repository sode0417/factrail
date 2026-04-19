export function getSourceColor(source: string): string {
  switch (source) {
    case 'github':
      return 'purple';
    case 'slack':
      return 'green';
    case 'manual':
      return 'blue';
    case 'browser':
      return 'orange';
    case 'claude-code':
      return 'teal';
    default:
      return 'gray';
  }
}

export function getSourceTagColors(source: string): { bg: string; color: string } {
  // Unified text color for consistency across all source tags.
  // Brand is expressed via the bg tint; readability is kept uniform.
  const color = '#2A2A2A';
  switch (source) {
    case 'github':
      return { bg: '#D8D3C5', color };
    case 'slack':
      return { bg: '#E8DAE9', color };
    case 'claude-code':
      return { bg: '#F5DDC7', color };
    case 'f2a':
      return { bg: '#D6E0E8', color };
    case 'manual':
      return { bg: '#E8F1EA', color };
    case 'browser':
      return { bg: '#F0E0D0', color };
    case 'comment':
      return { bg: '#EFE9D5', color };
    default:
      return { bg: '#EFE9D5', color };
  }
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case 'github':
      return 'GitHub';
    case 'slack':
      return 'Slack';
    case 'manual':
      return 'Manual';
    case 'browser':
      return 'Browser';
    case 'claude-code':
      return 'Claude Code';
    default:
      return source;
  }
}

/**
 * Markdown 記法を除去してプレーンテキストに変換する。
 * カードのサマリー表示用。
 */
export function stripMarkdown(text: string): string {
  return text
    // 見出し（## など）
    .replace(/^#{1,6}\s+/gm, '')
    // 画像 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // リンク [text](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 太字・斜体
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
    // インラインコード
    .replace(/`([^`]+)`/g, '$1')
    // コードブロック
    .replace(/```[\s\S]*?```/g, '')
    // 水平線
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // リストマーカー
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // チェックボックス
    .replace(/\[[ x]\]\s*/gi, '')
    // 余分な空行を詰める
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
