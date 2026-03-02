import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { GitHubApiService } from './github-api.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService, GitHubApiService, PrismaService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
