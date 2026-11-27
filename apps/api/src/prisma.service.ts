import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 はドライバの adapter が要る。表の場所はスキーマの @@schema で決まる
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    console.log('🔗 Initializing Prisma...');
  }

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
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
