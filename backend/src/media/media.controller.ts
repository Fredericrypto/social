import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsIn } from 'class-validator';

class GetUploadUrlDto {
  @IsIn(['avatars', 'posts', 'covers'])
  folder: 'avatars' | 'posts' | 'covers';

  @IsString()
  ext: string; // jpg, png, mp4...
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getUploadUrl(@Body() dto: GetUploadUrlDto) {
    return this.mediaService.getUploadUrl(dto.folder, dto.ext);
  }
}
