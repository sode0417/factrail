import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma.service';
import { CreateFactDto, QueryFactsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * 記録（Fact）を管理するサービス
 * 外部・内部で発生した観測可能な出来事を記録・検索する
 */
@Injectable()
export class FactsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('slack-dispatch') private readonly slackQueue: Queue,
  ) {}

  /**
   * 記録を検索する（カーソルベースページネーション）
   * @param query 検索条件（ソース、タイプ、日時範囲、ページング情報）
   * @returns ページングされた記録のリスト
   */
  async findAll(query: QueryFactsDto) {
    const { source, type, from, to, limit = 50, cursor } = query;

    // 検索条件を組み立て
    const where: Prisma.FactWhereInput = {};

    if (source) {
      where.source = source;
    }

    if (type) {
      where.type = type;
    }

    // 発生日時の範囲で絞り込み
    if (from || to) {
      where.occurredAt = {};
      if (from) {
        where.occurredAt.gte = new Date(from);
      }
      if (to) {
        where.occurredAt.lte = new Date(to);
      }
    }

    // カーソルベースページネーション: 次ページがあるか確認するため +1 件取得
    const facts = await this.prisma.fact.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // カーソル自体をスキップ
      }),
      select: {
        id: true,
        externalId: true,
        source: true,
        sourceUrl: true,
        occurredAt: true,
        title: true,
        summary: true,
        type: true,
        metadata: true,
        createdAt: true,
      },
    });

    // ページング情報を構築
    const hasMore = facts.length > limit;
    const data = hasMore ? facts.slice(0, -1) : facts;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data,
      meta: {
        hasMore,
        nextCursor,
      },
    };
  }

  /**
   * IDで単一の記録を取得する
   * @param id 記録のID
   * @returns 記録データ
   * @throws NotFoundException 記録が見つからない場合
   */
  async findOne(id: string) {
    const fact = await this.prisma.fact.findUnique({
      where: { id },
    });

    if (!fact) {
      throw new NotFoundException(`記録が見つかりません: ID "${id}"`);
    }

    return { data: fact };
  }

  /**
   * 新しい記録を作成し、Slack投稿キューに追加する
   * @param dto 記録作成用のDTO
   * @returns 作成された記録
   */
  async create(dto: CreateFactDto) {
    // 外部IDが指定されていない場合は、手動作成用のUUIDを生成
    const externalId = dto.externalId || `manual-${randomUUID()}`;

    const fact = await this.prisma.fact.create({
      data: {
        externalId,
        source: dto.source,
        sourceUrl: dto.sourceUrl,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        title: dto.title,
        summary: dto.summary,
        content: dto.content,
        raw: (dto.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
        type: dto.type,
        metadata: dto.metadata || Prisma.JsonNull,
      },
    });

    // Slack投稿キューに追加（非同期）
    await this.slackQueue.add(
      'send-dm',
      { factId: fact.id },
      {
        attempts: 5, // 最大5回リトライ
        backoff: {
          type: 'exponential',
          delay: 1000, // 初回1秒、以降指数的に増加
        },
      },
    );

    return { data: fact };
  }
}
