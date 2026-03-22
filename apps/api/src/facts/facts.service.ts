import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFactDto, QueryFactsDto, FactsStatsResponseDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * 記録（Fact）を管理するサービス
 * 外部・内部で発生した観測可能な出来事を記録・検索する
 */
@Injectable()
export class FactsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 記録を検索する（カーソルベースページネーション）
   * @param userId ユーザーID
   * @param query 検索条件（ソース、タイプ、日時範囲、ページング情報）
   * @returns ページングされた記録のリスト
   */
  async findAll(userId: string, query: QueryFactsDto) {
    const { source, type, from, to, limit = 50, cursor, grouped, projectId, categoryId } = query;

    // 検索条件を組み立て
    const where: Prisma.FactWhereInput = {
      userId,
    };

    if (source) {
      where.source = source;
    }

    if (type) {
      where.type = type;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
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

    // グループ表示モード: ungrouped + 親のみ取得
    if (grouped === 'true') {
      where.OR = [{ groupId: null }, { parentId: null }];
    }

    // カーソルベースページネーション: 次ページがあるか確認するため +1 件取得
    const facts = await this.prisma.fact.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
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
        groupId: true,
        groupType: true,
        projectId: true,
        categoryId: true,
        ...(grouped === 'true' && {
          _count: { select: { children: true } },
        }),
      },
    });

    // ページング情報を構築
    const hasMore = facts.length > limit;
    const rawData = hasMore ? facts.slice(0, -1) : facts;
    const nextCursor = hasMore ? rawData[rawData.length - 1]?.id : undefined;

    // グループモード時は childCount をマッピング
    const data =
      grouped === 'true'
        ? rawData.map((fact) => {
            const { _count, ...rest } = fact as typeof fact & { _count?: { children: number } };
            return { ...rest, childCount: _count?.children ?? 0 };
          })
        : rawData;

    return {
      data,
      meta: {
        hasMore,
        nextCursor,
      },
    };
  }

  /**
   * 指定された親 Fact の子 Fact 一覧を返す
   */
  async findChildren(userId: string, parentId: string) {
    // 親 Fact の存在とアクセス権チェック
    const parent = await this.prisma.fact.findFirst({
      where: { id: parentId, userId },
    });

    if (!parent) {
      throw new NotFoundException(`記録が見つかりません: ID "${parentId}"`);
    }

    const children = await this.prisma.fact.findMany({
      where: {
        parentId,
        userId,
      },
      orderBy: { occurredAt: 'asc' },
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
        groupId: true,
        groupType: true,
        projectId: true,
        categoryId: true,
      },
    });

    return { data: children };
  }

  /**
   * IDで単一の記録を取得する
   * @param userId ユーザーID
   * @param id 記録のID
   * @returns 記録データ
   * @throws NotFoundException 記録が見つからない場合
   */
  async findOne(userId: string, id: string) {
    const fact = await this.prisma.fact.findFirst({
      where: {
        id,
        userId, // ユーザーIDでフィルタ
      },
    });

    if (!fact) {
      throw new NotFoundException(`記録が見つかりません: ID "${id}"`);
    }

    return { data: fact };
  }

  /**
   * 新しい記録を作成し、Slack投稿キューに追加する
   * @param userId ユーザーID
   * @param dto 記録作成用のDTO
   * @returns 作成された記録
   */
  async create(userId: string, dto: CreateFactDto) {
    // 外部IDが指定されていない場合は、手動作成用のUUIDを生成
    const externalId = dto.externalId || `manual-${randomUUID()}`;

    const fact = await this.prisma.fact.create({
      data: {
        userId, // ユーザーIDを追加
        externalId,
        source: dto.source,
        sourceUrl: dto.sourceUrl,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        title: dto.title,
        summary: dto.summary,
        content: dto.content,
        raw: (dto.raw as Prisma.InputJsonValue) || Prisma.JsonNull,
        type: dto.type,
        metadata: dto.metadata || Prisma.JsonNull,
        parentId: dto.parentId,
        projectId: dto.projectId,
        categoryId: dto.categoryId,
      },
    });

    return { data: fact };
  }

  /**
   * 記録の統計情報を取得する
   * @param userId ユーザーID
   * @returns 今日（直近24時間）の記録数
   */
  async getStats(userId: string): Promise<FactsStatsResponseDto> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 今日（直近24時間）の記録数を取得
    const todayCount = await this.prisma.fact.count({
      where: {
        userId, // ユーザーIDでフィルタ
        occurredAt: {
          gte: oneDayAgo,
        },
      },
    });

    return {
      todayCount,
    };
  }
}
