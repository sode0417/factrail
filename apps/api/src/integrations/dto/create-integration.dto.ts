import { IsString, IsOptional, IsArray, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

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
}
