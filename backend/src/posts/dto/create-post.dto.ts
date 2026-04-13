import { IsString, IsOptional, IsArray } from 'class-validator';
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  postType?: string;
}
