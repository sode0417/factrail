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
