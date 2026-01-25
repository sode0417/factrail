import { IsString, IsOptional, IsArray, IsDateString, IsNotEmpty } from 'class-validator';

/**
 * インテグレーション作成用のDTO
 */
export class CreateIntegrationDto {
  /**
   * プロバイダー名（例: github, slack）
   */
  @IsString()
  @IsNotEmpty()
  provider: string;

  /**
   * 外部サービスのアカウントID
   */
  @IsString()
  @IsNotEmpty()
  accountId: string;

  /**
   * アカウント名（オプション）
   */
  @IsString()
  @IsOptional()
  accountName?: string;

  /**
   * アクセストークン
   */
  @IsString()
  @IsNotEmpty()
  accessToken: string;

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
}
