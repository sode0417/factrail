import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class UpdateIntegrationDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scope?: string[];

  @IsString()
  @IsOptional()
  status?: string;
}
