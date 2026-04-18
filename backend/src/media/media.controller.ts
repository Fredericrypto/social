import {
  Controller, Post, Body, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsIn } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';

class GetUploadUrlDto {
  @IsIn(['avatars', 'posts', 'covers', 'stories'])
  folder: 'avatars' | 'posts' | 'covers' | 'stories';

  @IsString()
  ext: string;
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ── Endpoint legado — mantido para compatibilidade com MinIO local ────────
  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getUploadUrl(@Body() dto: GetUploadUrlDto) {
    return this.mediaService.getUploadUrl(dto.folder, dto.ext);
  }

  // ── Novo endpoint — recebe arquivo multipart e faz upload direto ──────────
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');

    const validFolders = ['avatars', 'posts', 'covers', 'stories'];
    if (!validFolders.includes(folder)) {
      throw new BadRequestException(`folder deve ser um de: ${validFolders.join(', ')}`);
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${folder}/${uuidv4()}.${ext}`;

    const publicUrl = await this.mediaService.uploadFile(key, file.buffer, file.mimetype);
    return { publicUrl, key };
  }
}
