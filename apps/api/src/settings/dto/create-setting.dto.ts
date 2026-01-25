import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 設定作成用のDTO
 */
export class CreateSettingDto {
  /**
   * プロバイダー名（例: github, slack）
   */
  @IsString()
  @IsNotEmpty()
  provider: string;

  /**
   * 設定の種類
   */
  @IsString()
  @IsNotEmpty()
  settingType: string;

  /**
   * 設定値
   */
  @IsString()
  @IsNotEmpty()
  value: string;
}
