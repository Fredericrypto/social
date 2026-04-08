import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Request() req, @Param('postId') postId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(req.user.id, postId, dto);
  }

  @Get(':postId')
  findByPost(@Param('postId') postId: string, @Query('page') page = 1) {
    return this.commentsService.findByPost(postId, +page);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  delete(@Request() req, @Param('id') id: string) {
    return this.commentsService.delete(id, req.user.id);
  }
}
