import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSettingDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  settingType: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
