import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @ApiProperty({ required: false, enum: ['image', 'video', 'text'] })
  @IsOptional()
  @IsEnum(['image', 'video', 'text'])
  mediaType?: string;
}
