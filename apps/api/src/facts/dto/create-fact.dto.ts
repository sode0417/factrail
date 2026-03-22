import { IsString, IsOptional, IsDateString, IsObject, IsUUID } from 'class-validator';
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
   * 元データのJSON（raw data）
   * 手動メモ（source: manual）の場合は省略可能
   */
  @IsOptional()
  @IsObject()
  raw?: Prisma.InputJsonValue;

  /**
   * ソースへのURL（オプション）
   */
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  /**
   * 親FactのID（スレッド/コメント用）
   */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  /**
   * F2AプロジェクトID
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * F2AカテゴリID
   */
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
