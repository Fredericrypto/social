import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Request() req, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @Get('user/:username')
  findByUser(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 12,
  ) {
    return this.postsService.findByUser(username, +page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  delete(@Request() req, @Param('id') id: string) {
    return this.postsService.delete(id, req.user.id);
  }
}
