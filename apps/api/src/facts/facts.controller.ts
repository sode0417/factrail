import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FactsService } from './facts.service';
import { CreateFactDto, QueryFactsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 記録（Fact）のAPIエンドポイント
 * 外部・内部で発生した観測可能な出来事を管理する
 */
@Controller('api/facts')
@UseGuards(JwtAuthGuard) // 全エンドポイントに認証を要求
export class FactsController {
  constructor(private readonly factsService: FactsService) {}

  /**
   * 記録の統計情報を取得する
   * @returns 今日（直近24時間）の記録数
   */
  @Get('stats')
  getStats(@Request() req) {
    return this.factsService.getStats(req.user.id);
  }

  /**
   * 記録の一覧を取得する（カーソルベースページネーション）
   * @param query 検索条件（ソース、タイプ、日時範囲、ページング情報）
   * @returns ページングされた記録のリスト
   */
  @Get()
  findAll(@Request() req, @Query() query: QueryFactsDto) {
    return this.factsService.findAll(req.user.id, query);
  }

  /**
   * IDで単一の記録を取得する
   * @param id 記録のID
   * @returns 記録データ
   */
  @Get(':id')
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.factsService.findOne(req.user.id, id);
  }

  /**
   * 新しい記録を作成する
   * @param createFactDto 記録作成用のDTO
   * @returns 作成された記録
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() createFactDto: CreateFactDto) {
    return this.factsService.create(req.user.id, createFactDto);
  }
}
