import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportReason } from './entities/report.entity';

class ReportDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('post/:postId')
  reportPost(@Request() req, @Param('postId') postId: string, @Body() dto: ReportDto) {
    return this.reportsService.reportPost(req.user.id, postId, dto.reason, dto.description);
  }

  @Post('user/:userId')
  reportUser(@Request() req, @Param('userId') userId: string, @Body() dto: ReportDto) {
    return this.reportsService.reportUser(req.user.id, userId, dto.reason, dto.description);
  }
}
