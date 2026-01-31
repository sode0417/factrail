/**
 * 記録の統計情報レスポンス
 * 将来的に週次・月次の統計も追加可能な構造
 */
export class FactsStatsResponseDto {
  /** 今日（直近24時間）の記録数 */
  todayCount: number;

  // 将来的に追加予定:
  // /** 過去7日間の記録数 */
  // last7DaysCount?: number;
  // /** 過去30日間の記録数 */
  // last30DaysCount?: number;
}
