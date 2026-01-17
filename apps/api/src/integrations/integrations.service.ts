import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../common/crypto';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { Integration } from '@prisma/client';

/**
 * トークンが復号化されたIntegration
 */
export interface DecryptedIntegration extends Omit<Integration, 'accessToken' | 'refreshToken'> {
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * トークンを暗号化して新しいIntegrationを作成する
   */
  async create(dto: CreateIntegrationDto): Promise<DecryptedIntegration> {
    const encryptedAccessToken = this.cryptoService.encrypt(dto.accessToken);
    const encryptedRefreshToken = dto.refreshToken
      ? this.cryptoService.encrypt(dto.refreshToken)
      : null;

    const integration = await this.prisma.integration.create({
      data: {
        provider: dto.provider,
        accountId: dto.accountId,
        accountName: dto.accountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scope: dto.scope ?? [],
      },
    });

    return this.decryptIntegration(integration);
  }

  /**
   * 全てのIntegrationを取得する（トークンは復号化済み）
   */
  async findAll(): Promise<DecryptedIntegration[]> {
    const integrations = await this.prisma.integration.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((integration) => this.decryptIntegration(integration));
  }

  /**
   * プロバイダーでIntegrationを検索する（トークンは復号化済み）
   */
  async findByProvider(provider: string): Promise<DecryptedIntegration[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { provider },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((integration) => this.decryptIntegration(integration));
  }

  /**
   * IDで単一のIntegrationを取得する（トークンは復号化済み）
   */
  async findOne(id: string): Promise<DecryptedIntegration> {
    const integration = await this.prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    return this.decryptIntegration(integration);
  }

  /**
   * プロバイダーとアカウントIDでIntegrationを検索する（トークンは復号化済み）
   */
  async findByProviderAndAccount(
    provider: string,
    accountId: string,
  ): Promise<DecryptedIntegration | null> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        provider_accountId: { provider, accountId },
      },
    });

    if (!integration) {
      return null;
    }

    return this.decryptIntegration(integration);
  }

  /**
   * Integrationを更新する（トークンが指定された場合は暗号化する）
   */
  async update(id: string, dto: UpdateIntegrationDto): Promise<DecryptedIntegration> {
    const existing = await this.prisma.integration.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.accountName !== undefined) {
      updateData.accountName = dto.accountName;
    }

    if (dto.accessToken !== undefined) {
      updateData.accessToken = this.cryptoService.encrypt(dto.accessToken);
    }

    if (dto.refreshToken !== undefined) {
      updateData.refreshToken = dto.refreshToken
        ? this.cryptoService.encrypt(dto.refreshToken)
        : null;
    }

    if (dto.expiresAt !== undefined) {
      updateData.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    if (dto.scope !== undefined) {
      updateData.scope = dto.scope;
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    const integration = await this.prisma.integration.update({
      where: { id },
      data: updateData,
    });

    return this.decryptIntegration(integration);
  }

  /**
   * Integrationを作成または更新する（upsert、トークンは暗号化）
   */
  async upsert(dto: CreateIntegrationDto): Promise<DecryptedIntegration> {
    const encryptedAccessToken = this.cryptoService.encrypt(dto.accessToken);
    const encryptedRefreshToken = dto.refreshToken
      ? this.cryptoService.encrypt(dto.refreshToken)
      : null;

    const integration = await this.prisma.integration.upsert({
      where: {
        provider_accountId: {
          provider: dto.provider,
          accountId: dto.accountId,
        },
      },
      create: {
        provider: dto.provider,
        accountId: dto.accountId,
        accountName: dto.accountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scope: dto.scope ?? [],
      },
      update: {
        accountName: dto.accountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scope: dto.scope ?? [],
        status: 'active',
      },
    });

    return this.decryptIntegration(integration);
  }

  /**
   * 最終同期タイムスタンプを更新する
   */
  async updateLastSync(id: string): Promise<void> {
    await this.prisma.integration.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });
  }

  /**
   * Integrationを削除する
   */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.integration.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    await this.prisma.integration.delete({
      where: { id },
    });
  }

  /**
   * Integrationを無効化する
   */
  async deactivate(id: string): Promise<DecryptedIntegration> {
    return this.update(id, { status: 'inactive' });
  }

  /**
   * トークンが期限切れ、または期限切れ間近（5分以内）かどうかを判定する
   */
  isTokenExpired(integration: DecryptedIntegration): boolean {
    if (!integration.expiresAt) {
      return false;
    }

    const expiresAt = new Date(integration.expiresAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    return expiresAt <= fiveMinutesFromNow;
  }

  /**
   * Integrationレコードのトークンを復号化する
   */
  private decryptIntegration(integration: Integration): DecryptedIntegration {
    return {
      ...integration,
      accessToken: this.cryptoService.decrypt(integration.accessToken),
      refreshToken: integration.refreshToken
        ? this.cryptoService.decrypt(integration.refreshToken)
        : null,
    };
  }
}
