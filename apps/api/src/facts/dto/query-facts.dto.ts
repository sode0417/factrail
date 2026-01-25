import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
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
   * ページネーション用のカーソル（オプション）
   */
  @IsOptional()
  @IsString()
  cursor?: string;
}
