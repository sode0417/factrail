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

@Controller('api/facts')
export class FactsController {
  constructor(private readonly factsService: FactsService) {}

  @Get()
  findAll(@Query() query: QueryFactsDto) {
    return this.factsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.factsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFactDto: CreateFactDto) {
    return this.factsService.create(createFactDto);
  }
}
