import { Controller, Post, Delete, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavedService } from './saved.service';

@ApiTags('saved')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  getMySaved(@Request() req, @Query('page') page = 1) {
    return this.savedService.getMySaved(req.user.id, +page);
  }

  @Post(':postId')
  save(@Request() req, @Param('postId') postId: string) {
    return this.savedService.save(req.user.id, postId);
  }

  @Delete(':postId')
  unsave(@Request() req, @Param('postId') postId: string) {
    return this.savedService.unsave(req.user.id, postId);
  }
}
