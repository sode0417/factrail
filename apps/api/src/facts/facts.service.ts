import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFactDto, QueryFactsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class FactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryFactsDto) {
    const { source, type, from, to, limit = 50, cursor } = query;

    const where: Prisma.FactWhereInput = {};

    if (source) {
      where.source = source;
    }

    if (type) {
      where.type = type;
    }

    if (from || to) {
      where.occurredAt = {};
      if (from) {
        where.occurredAt.gte = new Date(from);
      }
      if (to) {
        where.occurredAt.lte = new Date(to);
      }
    }

    const facts = await this.prisma.fact.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit + 1, // 次ページがあるかを確認するため+1
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

  async findOne(id: string) {
    const fact = await this.prisma.fact.findUnique({
      where: { id },
    });

    if (!fact) {
      throw new NotFoundException(`Fact with ID "${id}" not found`);
    }

    return { data: fact };
  }

  async create(dto: CreateFactDto) {
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

    return { data: fact };
  }
}
