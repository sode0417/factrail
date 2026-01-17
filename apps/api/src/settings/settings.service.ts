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
   */
  async upsert(dto: CreateSettingDto): Promise<SettingResponse> {
    const encryptedValue = this.cryptoService.encrypt(dto.value);

    const setting = await this.prisma.settings.upsert({
      where: {
        provider_settingType: {
          provider: dto.provider,
          settingType: dto.settingType,
        },
      },
      create: {
        provider: dto.provider,
        settingType: dto.settingType,
        value: encryptedValue,
      },
      update: {
        value: encryptedValue,
      },
    });

    return this.toResponse(setting);
  }

  /**
   * 全ての設定を取得する（値は非表示）
   */
  async findAll(provider?: string): Promise<SettingResponse[]> {
    const settings = await this.prisma.settings.findMany({
      where: provider ? { provider } : undefined,
      orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
    });

    return settings.map((setting) => this.toResponse(setting));
  }

  /**
   * 特定の設定を取得する（値は非表示）
   */
  async findOne(provider: string, settingType: string): Promise<SettingResponse> {
    const setting = await this.prisma.settings.findUnique({
      where: {
        provider_settingType: { provider, settingType },
      },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting not found: ${provider}/${settingType}`,
      );
    }

    return this.toResponse(setting);
  }

  /**
   * 特定の設定の復号化された値を取得する（内部用）
   */
  async getDecryptedValue(provider: string, settingType: string): Promise<string | null> {
    const setting = await this.prisma.settings.findUnique({
      where: {
        provider_settingType: { provider, settingType },
      },
    });

    if (!setting) {
      return null;
    }

    return this.cryptoService.decrypt(setting.value);
  }

  /**
   * 設定を削除する
   */
  async remove(provider: string, settingType: string): Promise<void> {
    const setting = await this.prisma.settings.findUnique({
      where: {
        provider_settingType: { provider, settingType },
      },
    });

    if (!setting) {
      throw new NotFoundException(
        `Setting not found: ${provider}/${settingType}`,
      );
    }

    await this.prisma.settings.delete({
      where: {
        provider_settingType: { provider, settingType },
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
