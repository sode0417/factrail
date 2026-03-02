import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { AddRepositoryDto } from './dto/add-repository.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('repositories')
@UseGuards(JwtAuthGuard)
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  findAll(@Request() req) {
    return this.repositoriesService.findAll(req.user.id);
  }

  @Get('github/available')
  getAvailable(@Request() req) {
    return this.repositoriesService.getAvailableRepositories(req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Request() req, @Body() dto: AddRepositoryDto) {
    return this.repositoriesService.add(req.user.id, dto.fullName);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.repositoriesService.remove(req.user.id, id);
  }

  @Post('detect')
  detect(@Request() req) {
    return this.repositoriesService.detectFromFacts(req.user.id);
  }
}
