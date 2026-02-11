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
  UseGuards,
  Request,
} from '@nestjs/common';
import { SettingsService, SettingResponse } from './settings.service';
import { CreateSettingDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 設定を作成または更新する
   * グローバル設定（webhook_secret等）はuserId=nullで保存
   */
  @Post()
  async upsert(@Request() req, @Body() dto: CreateSettingDto): Promise<SettingResponse> {
    return this.settingsService.upsert(dto);
  }

  /**
   * 全ての設定を取得する（値は非表示）
   * 認証ユーザーの設定 + グローバル設定を返す
   */
  @Get()
  async findAll(@Request() req, @Query('provider') provider?: string): Promise<SettingResponse[]> {
    return this.settingsService.findAll(provider, req.user.id);
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
