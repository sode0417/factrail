import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { GitHubApiService } from './github-api.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SettingsModule } from '../settings/settings.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [IntegrationsModule, SettingsModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService, GitHubApiService, PrismaService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
