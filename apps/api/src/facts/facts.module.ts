import { Module } from '@nestjs/common';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FactsController],
  providers: [FactsService, PrismaService],
  exports: [FactsService],
})
export class FactsModule {}
