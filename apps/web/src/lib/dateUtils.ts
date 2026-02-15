export type DatePreset = 'today' | 'thisWeek' | 'thisMonth';

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/**
 * プリセットに対応する日付範囲を返す (YYYY-MM-DD)
 */
export function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  const to = formatLocalDate(now);

  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'thisWeek': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // 月曜始まり
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: formatLocalDate(monday), to };
    }
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatLocalDate(firstDay), to };
    }
  }
}

/**
 * YYYY-MM-DD → ローカル日の開始 (00:00:00) を UTC ISO8601 に変換
 */
export function toISOStart(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return date.toISOString();
}

/**
 * YYYY-MM-DD → ローカル日の終了 (23:59:59.999) を UTC ISO8601 に変換
 */
export function toISOEnd(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
