import { Module, forwardRef } from '@nestjs/common';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { PrismaService } from '../prisma.service';
import { DispatchersModule } from '../dispatchers/dispatchers.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DispatchersModule, forwardRef(() => AuthModule)],
  controllers: [FactsController],
  providers: [FactsService, PrismaService],
  exports: [FactsService],
})
export class FactsModule {}
