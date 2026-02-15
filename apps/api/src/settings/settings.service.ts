import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../common/crypto';
import { CreateSettingDto } from './dto';
import { Settings } from '@prisma/client';

/**
 * 設定のレスポンス型（値は非表示）
 */
export interface SettingResponse {
  id: string;
  provider: string;
  settingType: string;
  hasValue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * 設定を作成または更新する（値は暗号化して保存）
   * @param dto 設定データ
   * @param userId ユーザーID（nullの場合はグローバル設定）
   */
  async upsert(dto: CreateSettingDto, userId?: string | null): Promise<SettingResponse> {
    const encryptedValue = this.cryptoService.encrypt(dto.value);

    const setting = await this.prisma.settings.upsert({
      where: {
        userId_provider_settingType: {
          userId: userId ?? null,
          provider: dto.provider,
          settingType: dto.settingType,
        },
      },
      create: {
        provider: dto.provider,
        settingType: dto.settingType,
        value: encryptedValue,
        userId: userId ?? null,
      },
      update: {
        value: encryptedValue,
      },
    });

    return this.toResponse(setting);
  }

  /**
   * 全ての設定を取得する（値は非表示）
   * @param provider プロバイダーでフィルタ
   * @param userId ユーザーID（指定時はそのユーザーの設定のみ返す）
   */
  async findAll(provider?: string, userId?: string | null): Promise<SettingResponse[]> {
    const where: Record<string, unknown> = {};
    if (provider) {
      where.provider = provider;
    }
    if (userId) {
      where.userId = userId;
    }

    const settings = await this.prisma.settings.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
    });

    return settings.map((setting) => this.toResponse(setting));
  }

  /**
   * 特定の設定を取得する（値は非表示）
   */
  async findOne(
    provider: string,
    settingType: string,
    userId?: string | null,
  ): Promise<SettingResponse> {
    const setting = await this.prisma.settings.findUnique({
      where: {
        userId_provider_settingType: {
          userId: userId ?? null,
          provider,
          settingType,
        },
      },
    });

    if (!setting) {
      throw new NotFoundException(`設定が見つかりません: ${provider}/${settingType}`);
    }

    return this.toResponse(setting);
  }

  /**
   * 特定の設定の復号化された値を取得する（内部用）
   * userIdが指定された場合、ユーザー別設定を優先し、なければグローバル設定にフォールバック
   */
  async getDecryptedValue(
    provider: string,
    settingType: string,
    userId?: string | null,
  ): Promise<string | null> {
    // ユーザー別設定を検索
    if (userId) {
      const userSetting = await this.prisma.settings.findUnique({
        where: {
          userId_provider_settingType: {
            userId,
            provider,
            settingType,
          },
        },
      });

      if (userSetting) {
        return this.cryptoService.decrypt(userSetting.value);
      }
    }

    // グローバル設定（userId=NULL）にフォールバック
    const globalSetting = await this.prisma.settings.findUnique({
      where: {
        userId_provider_settingType: {
          userId: null,
          provider,
          settingType,
        },
      },
    });

    if (!globalSetting) {
      return null;
    }

    return this.cryptoService.decrypt(globalSetting.value);
  }

  /**
   * 設定を削除する
   */
  async remove(provider: string, settingType: string, userId?: string | null): Promise<void> {
    const setting = await this.prisma.settings.findUnique({
      where: {
        userId_provider_settingType: {
          userId: userId ?? null,
          provider,
          settingType,
        },
      },
    });

    if (!setting) {
      throw new NotFoundException(`設定が見つかりません: ${provider}/${settingType}`);
    }

    await this.prisma.settings.delete({
      where: {
        userId_provider_settingType: {
          userId: userId ?? null,
          provider,
          settingType,
        },
      },
    });
  }

  /**
   * 設定をレスポンス形式に変換する（値は隠蔽）
   */
  private toResponse(setting: Settings): SettingResponse {
    return {
      id: setting.id,
      provider: setting.provider,
      settingType: setting.settingType,
      hasValue: !!setting.value,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }
}
