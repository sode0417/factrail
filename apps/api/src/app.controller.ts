import { Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Post('test-insert')
  async testInsert() {
    const fact = await this.prisma.fact.create({
      data: {
        externalId: 'nestjs-test-001',
        source: 'nestjs-api',
        sourceUrl: 'http://localhost:3000',
        occurredAt: new Date(),
        title: 'NestJS → Prisma → Supabase 接続テスト',
        summary: 'このデータはNestJSから挿入されました',
        raw: {
          test: true,
          source: 'nestjs',
          purpose: 'api-connection-test',
        },
        type: 'test.nestjs_created',
        metadata: {
          verified: true,
          priority: 'high',
        },
      },
    });

    return {
      success: true,
      message: 'Data inserted successfully',
      data: fact,
    };
  }

  @Get('test-read')
  async testRead() {
    const facts = await this.prisma.fact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      success: true,
      count: facts.length,
      data: facts,
    };
  }
}
