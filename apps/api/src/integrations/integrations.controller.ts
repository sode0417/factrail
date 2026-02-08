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
  UseGuards,
  Request,
} from '@nestjs/common';
import { IntegrationsService, DecryptedIntegration } from './integrations.service';
import { SlackOAuthService } from './slack-oauth.service';
import { SlackOAuthStateService } from './slack-oauth-state.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SlackOAuthCallbackDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
@UseGuards(JwtAuthGuard) // 全エンドポイントに認証を要求
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly slackOAuthService: SlackOAuthService,
    private readonly slackOAuthStateService: SlackOAuthStateService,
  ) {}

  /**
   * 新しいIntegrationを作成する
   */
  @Post()
  async create(@Request() req, @Body() dto: CreateIntegrationDto): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.create(req.user.id, dto);
    return this.toResponse(integration);
  }

  /**
   * 全てのIntegrationを取得する
   */
  @Get()
  async findAll(
    @Request() req,
    @Query('provider') provider?: string,
  ): Promise<{ data: IntegrationResponse[] }> {
    const integrations = provider
      ? await this.integrationsService.findByProvider(req.user.id, provider)
      : await this.integrationsService.findAll(req.user.id);

    return {
      data: integrations.map((integration) => this.toResponse(integration)),
    };
  }

  /**
   * IDで単一のIntegrationを取得する
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.findOne(req.user.id, id);
    return this.toResponse(integration);
  }

  /**
   * Integrationを更新する
   */
  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.update(req.user.id, id, dto);
    return this.toResponse(integration);
  }

  /**
   * Integrationを削除する
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.integrationsService.remove(req.user.id, id);
    return { success: true };
  }

  /**
   * Integrationを無効化する
   */
  @Post(':id/deactivate')
  async deactivate(@Request() req, @Param('id') id: string): Promise<IntegrationResponse> {
    const integration = await this.integrationsService.deactivate(req.user.id, id);
    return this.toResponse(integration);
  }

  /**
   * Slack OAuth用のstateパラメータを生成する
   * 認証済みユーザーのIDを含む署名付きstateを返す
   */
  @Get('slack/oauth-state')
  getSlackOAuthState(@Request() req): { state: string } {
    const state = this.slackOAuthStateService.generateState(req.user.id);
    return { state };
  }

  /**
   * Slack OAuth callbackを処理する
   * 注意: このエンドポイントは認証不要（OAuth callbackのため）
   */
  @Post('slack/callback')
  @HttpCode(HttpStatus.OK)
  async slackCallback(@Body() dto: SlackOAuthCallbackDto): Promise<{ success: boolean }> {
    await this.slackOAuthService.handleCallback(dto.code, dto.state);
    return { success: true };
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
