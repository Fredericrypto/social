import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, MinLength, IsOptional } from 'class-validator';

class StartConversationDto {
  @IsString()
  userId: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(0)
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

class ReactDto {
  @IsOptional()
  @IsString()
  emoji?: string | null; // null = remover reação do userId
}

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Post('conversations')
  startConversation(@Request() req, @Body() dto: StartConversationDto) {
    return this.messagesService.getOrCreateConversation(req.user.id, dto.userId);
  }

  @Delete('conversations/:id/clear')
  @HttpCode(204)
  async clearConversation(@Request() req, @Param('id') id: string) {
    await this.messagesService.clearConversation(id, req.user.id);
  }

  @Get('conversations/:id')
  getMessages(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page = 1,
  ) {
    return this.messagesService.getMessages(id, req.user.id, +page);
  }

  @Post('conversations/:id')
  sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      req.user.id, id, dto.content, dto.imageUrl,
    );
  }

  /** Reagir — PATCH /messages/:id/reaction
   *  Body: { emoji: '❤️' } para reagir
   *  Body: { emoji: null } para remover
   *  Toggle: mesmo emoji enviado duas vezes remove a reação
   */
  @Patch(':id/reaction')
  async reactToMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.messagesService.reactToMessage(id, req.user.id, dto.emoji ?? null);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteMessage(@Request() req, @Param('id') id: string) {
    await this.messagesService.deleteMessage(id, req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.id);
  }
}
