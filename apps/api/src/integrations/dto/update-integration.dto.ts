import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

/**
 * インテグレーション更新用のDTO
 */
export class UpdateIntegrationDto {
  /**
   * アカウント名（オプション）
   */
  @IsString()
  @IsOptional()
  accountName?: string;

  /**
   * アクセストークン（オプション）
   */
  @IsString()
  @IsOptional()
  accessToken?: string;

  /**
   * リフレッシュトークン（オプション）
   */
  @IsString()
  @IsOptional()
  refreshToken?: string;

  /**
   * トークンの有効期限（ISO8601形式、オプション）
   */
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  /**
   * 認可スコープの配列（オプション）
   */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scope?: string[];

  /**
   * インテグレーションのステータス（オプション）
   */
  @IsString()
  @IsOptional()
  status?: string;
}
