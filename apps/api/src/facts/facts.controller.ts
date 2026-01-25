import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FactsService } from './facts.service';
import { CreateFactDto, QueryFactsDto } from './dto';

/**
 * 記録（Fact）のAPIエンドポイント
 * 外部・内部で発生した観測可能な出来事を管理する
 */
@Controller('api/facts')
export class FactsController {
  constructor(private readonly factsService: FactsService) {}

  /**
   * 記録の一覧を取得する（カーソルベースページネーション）
   * @param query 検索条件（ソース、タイプ、日時範囲、ページング情報）
   * @returns ページングされた記録のリスト
   */
  @Get()
  findAll(@Query() query: QueryFactsDto) {
    return this.factsService.findAll(query);
  }

  /**
   * IDで単一の記録を取得する
   * @param id 記録のID
   * @returns 記録データ
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.factsService.findOne(id);
  }

  /**
   * 新しい記録を作成する
   * @param createFactDto 記録作成用のDTO
   * @returns 作成された記録
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFactDto: CreateFactDto) {
    return this.factsService.create(createFactDto);
  }
}
