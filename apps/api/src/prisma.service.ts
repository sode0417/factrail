import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPgAdapter } from './prisma-adapter';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 から実行時の接続は driver adapter で渡す
    super({ adapter: createPgAdapter() });
    console.log('🔗 Initializing Prisma...');
  }

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        // adapter では $connect だけでは接続しないので、実際に1回問い合わせて確かめる
        await this.$queryRaw`SELECT 1`;
        console.log('✅ Database connected');
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`❌ Database connection failed after ${maxRetries} attempts`);
          throw error;
        }
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        console.warn(
          `⚠️ Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
