import {
  Controller, Get, Post, Delete, Body, Param,
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
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
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

  // ── IMPORTANTE: rotas estáticas ANTES das dinâmicas (:id) ─────────────────
  // Se @Delete('conversations/:id/clear') vier depois de @Get('conversations/:id'),
  // o NestJS interpreta "clear" como o valor de :id e retorna 404.

  /** Limpar conversa — persiste lastClearedAt para o usuário solicitante */
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
    return this.messagesService.sendMessage(req.user.id, id, dto.content, dto.imageUrl);
  }

  /** Apagar mensagem individual — marca isDeleted=true no banco */
  @Delete(':messageId')
  @HttpCode(204)
  async deleteMessage(
    @Request() req,
    @Param('messageId') messageId: string,
  ) {
    await this.messagesService.deleteMessage(messageId, req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.id);
  }
}
