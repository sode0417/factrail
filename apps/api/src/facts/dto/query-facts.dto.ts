import { IsOptional, IsString, IsDateString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ファクト検索用のDTO
 */
export class QueryFactsDto {
  /**
   * ファクトのソースでフィルタリング（オプション）
   */
  @IsOptional()
  @IsString()
  source?: string;

  /**
   * ファクトの種類でフィルタリング（オプション）
   */
  @IsOptional()
  @IsString()
  type?: string;

  /**
   * 検索開始日時（ISO8601形式、オプション）
   */
  @IsOptional()
  @IsDateString()
  from?: string;

  /**
   * 検索終了日時（ISO8601形式、オプション）
   */
  @IsOptional()
  @IsDateString()
  to?: string;

  /**
   * 取得件数の上限（1〜100、デフォルト: 50）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  /**
   * タイトル・要約に対する部分一致検索（オプション）
   *
   * 送り手（MCP の query_facts / factrail-query スキル）が「title/summary の全文検索」
   * として送ってくるパラメータ。受け口が無いと ValidationPipe の whitelist に落とされ、
   * 絞り込まれていない結果がそのまま「検索結果」として返るため、ここで明示的に受ける。
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /**
   * ページネーション用のカーソル（オプション）
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * グループ表示モード（"true" でグループ化して表示）
   */
  @IsOptional()
  @IsString()
  grouped?: string;

  /**
   * F2AプロジェクトIDでフィルタリング（オプション）
   */
  @IsOptional()
  @IsString()
  projectId?: string;

  /**
   * F2AカテゴリIDでフィルタリング（オプション）
   */
  @IsOptional()
  @IsString()
  categoryId?: string;
}
