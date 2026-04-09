import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('blocks')
@Controller('blocks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post(':userId')
  block(@Request() req, @Param('userId') userId: string) {
    return this.blocksService.block(req.user.id, userId);
  }

  @Delete(':userId')
  unblock(@Request() req, @Param('userId') userId: string) {
    return this.blocksService.unblock(req.user.id, userId);
  }

  @Get()
  getBlocked(@Request() req) {
    return this.blocksService.getBlockedUsers(req.user.id);
  }
}
