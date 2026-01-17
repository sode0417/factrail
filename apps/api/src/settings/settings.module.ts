import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma.service';
import { CryptoModule } from '../common/crypto';

@Module({
  imports: [CryptoModule],
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService],
  exports: [SettingsService],
})
export class SettingsModule {}
