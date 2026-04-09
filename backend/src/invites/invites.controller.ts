import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsOptional, IsEmail } from 'class-validator';

class CreateInviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}

@ApiTags('invites')
@Controller('invites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateInviteDto) {
    return this.invitesService.create(req.user.id, dto.email);
  }

  @Get()
  getMyInvites(@Request() req) {
    return this.invitesService.getMyInvites(req.user.id);
  }

  @Get('validate/:token')
  validate(@Param('token') token: string) {
    return this.invitesService.validate(token);
  }
}
