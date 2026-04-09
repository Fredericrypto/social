import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, MinLength } from 'class-validator';

class StartConversationDto {
  @IsString()
  userId: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(1)
  content: string;
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

  @Get('conversations/:id')
  getMessages(@Request() req, @Param('id') id: string, @Query('page') page = 1) {
    return this.messagesService.getMessages(id, req.user.id, +page);
  }

  @Post('conversations/:id')
  sendMessage(@Request() req, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(req.user.id, id, dto.content);
  }

  @Get('unread-count')
  unreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.id);
  }
}
