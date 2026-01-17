import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService, SettingResponse } from './settings.service';
import { CreateSettingDto } from './dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 設定を作成または更新する
   */
  @Post()
  async upsert(@Body() dto: CreateSettingDto): Promise<SettingResponse> {
    return this.settingsService.upsert(dto);
  }

  /**
   * 全ての設定を取得する（値は非表示）
   */
  @Get()
  async findAll(@Query('provider') provider?: string): Promise<SettingResponse[]> {
    return this.settingsService.findAll(provider);
  }

  /**
   * 特定の設定を取得する（値は非表示）
   */
  @Get(':provider/:settingType')
  async findOne(
    @Param('provider') provider: string,
    @Param('settingType') settingType: string,
  ): Promise<SettingResponse> {
    return this.settingsService.findOne(provider, settingType);
  }

  /**
   * 設定を削除する
   */
  @Delete(':provider/:settingType')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('provider') provider: string,
    @Param('settingType') settingType: string,
  ): Promise<void> {
    await this.settingsService.remove(provider, settingType);
  }
}
