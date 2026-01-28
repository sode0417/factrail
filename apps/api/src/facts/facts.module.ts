import { Module } from '@nestjs/common';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { PrismaService } from '../prisma.service';
import { DispatchersModule } from '../dispatchers/dispatchers.module';

@Module({
  imports: [DispatchersModule],
  controllers: [FactsController],
  providers: [FactsService, PrismaService],
  exports: [FactsService],
})
export class FactsModule {}
