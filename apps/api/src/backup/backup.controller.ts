import { Controller, Post, Res, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * バックアップ API エンドポイント
 * ユーザーデータを JSON 形式でエクスポートする
 */
@Controller('api/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * ユーザーデータのバックアップを手動で作成・ダウンロードする
   * @returns JSON 形式のバックアップファイル
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async trigger(@Request() req, @Res() res: Response): Promise<void> {
    const backup = await this.backupService.createUserBackup(req.user.id);

    const filename = `factrail-backup-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  }
}
