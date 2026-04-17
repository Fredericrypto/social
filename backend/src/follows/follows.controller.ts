import {
  Controller, Post, Delete, Get,
  Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@ApiTags('follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  follow(@Request() req, @Param('userId') userId: string) {
    return this.followsService.follow(req.user.id, userId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unfollow(@Request() req, @Param('userId') userId: string) {
    return this.followsService.unfollow(req.user.id, userId);
  }

  // OptionalJwtGuard: público mas enriquece isFollowing quando logado
  @Get(':userId/followers')
  @UseGuards(OptionalJwtGuard)
  getFollowers(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Request() req: any,
  ) {
    return this.followsService.getFollowers(userId, +page, 20, req.user?.id);
  }

  @Get(':userId/following')
  @UseGuards(OptionalJwtGuard)
  getFollowing(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Request() req: any,
  ) {
    return this.followsService.getFollowing(userId, +page, 20, req.user?.id);
  }
}
