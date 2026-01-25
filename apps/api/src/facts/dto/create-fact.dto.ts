import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

/**
 * ファクト作成用のDTO
 */
export class CreateFactDto {
  /**
   * ファクトのソース（例: GitHub, Slack, Email）
   */
  @IsString()
  source: string;

  /**
   * ファクトのタイトル
   */
  @IsString()
  title: string;

  /**
   * ファクトの要約（オプション）
   */
  @IsOptional()
  @IsString()
  summary?: string;

  /**
   * ファクトの本文内容（オプション）
   */
  @IsOptional()
  @IsString()
  content?: string;

  /**
   * ファクトの種類（例: issue, pull_request, message）
   */
  @IsString()
  type: string;

  /**
   * ファクトが発生した日時（ISO8601形式、オプション）
   */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  /**
   * 追加のメタデータ（JSON形式、オプション）
   */
  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;

  /**
   * 外部システムでのID（オプション）
   */
  @IsOptional()
  @IsString()
  externalId?: string;

  /**
   * ソースへのURL（オプション）
   */
  @IsOptional()
  @IsString()
  sourceUrl?: string;
}
