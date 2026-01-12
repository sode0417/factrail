import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateFactDto {
  @IsString()
  source: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}
