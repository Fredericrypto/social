import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { StoriesService } from "./stories.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { IsString, IsOptional, IsIn, IsNumber } from "class-validator";

class CreateStoryDto {
  @IsString()
  mediaUrl: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsNumber()
  durationHours?: number; // 1 | 6 | 12 | 24
}

@ApiTags("stories")
@Controller("stories")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(req.user.id, dto.mediaUrl, dto.caption, dto.durationHours);
  }

  @Get("feed")
  getFeed(@Request() req) {
    return this.storiesService.getFeedStories(req.user.id);
  }

  @Get("mine")
  getMine(@Request() req) {
    return this.storiesService.getMyStories(req.user.id);
  }

  @Get("user/:username")
  getByUsername(@Request() req, @Param("username") username: string) {
    return this.storiesService.getStoriesByUsername(username, req.user.id);
  }

  @Post(":id/view")
  view(@Request() req, @Param("id") id: string) {
    return this.storiesService.markViewed(id, req.user.id);
  }

  @Delete(":id")
  delete(@Request() req, @Param("id") id: string) {
    return this.storiesService.delete(id, req.user.id);
  }
}
