import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IntegrationsService, DecryptedIntegration } from './integrations.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

/**
 * 機密トークンデータを除外したレスポンス型
 */
interface IntegrationResponse {
  id: string;
  provider: string;
  accountId: string;
  accountName: string | null;
  expiresAt: Date | null;
  scope: string[];
  status: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * 新しいIntegrationを作成する
   */
  @Post()
  async create(@Body() dto: CreateIntegrationDto): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.create(dto);
    return this.toResponse(integration);
  }

  /**
   * 全てのIntegrationを取得する
   */
  @Get()
  async findAll(@Query('provider') provider?: string): Promise<IntegrationResponse[]> {
    const integrations = provider
      ? await this.integrationsService.findByProvider(provider)
      : await this.integrationsService.findAll();

    return integrations.map((integration) => this.toResponse(integration));
  }

  /**
   * IDで単一のIntegrationを取得する
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.findOne(id);
    return this.toResponse(integration);
  }

  /**
   * Integrationを更新する
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.update(id, dto);
    return this.toResponse(integration);
  }

  /**
   * Integrationを削除する
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.integrationsService.remove(id);
  }

  /**
   * Integrationを無効化する
   */
  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.deactivate(id);
    return this.toResponse(integration);
  }

  /**
   * Integrationをレスポンス形式に変換する（機密データを隠蔽）
   */
  private toResponse(integration: DecryptedIntegration): IntegrationResponse {
    return {
      id: integration.id,
      provider: integration.provider,
      accountId: integration.accountId,
      accountName: integration.accountName,
      expiresAt: integration.expiresAt,
      scope: integration.scope,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      hasAccessToken: !!integration.accessToken,
      hasRefreshToken: !!integration.refreshToken,
    };
  }
}
