import { Controller, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('likes')
@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  like(@Request() req, @Param('postId') postId: string) {
    return this.likesService.like(req.user.id, postId);
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unlike(@Request() req, @Param('postId') postId: string) {
    return this.likesService.unlike(req.user.id, postId);
  }
}
