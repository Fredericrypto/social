import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagesService } from './messages.service';
import { Block } from '../blocks/entities/block.entity';
import { Conversation } from './entities/conversation.entity';
import { UsersService } from '../users/users.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/messages' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSockets = new Map<string, string>();   // userId → socketId
  private socketRooms = new Map<string, Set<string>>(); // socketId → Set<convId>

  constructor(
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Block)
    private readonly blockRepo: Repository<Block>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
  ) {}

  // ── Conexão ───────────────────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      this.userSockets.set(payload.sub, client.id);
      this.socketRooms.set(client.id, new Set());
      client.join(`user:${payload.sub}`);

      // Marcar como online no banco
      try {
        await this.usersService.update(payload.sub, { presenceStatus: 'online' });
      } catch { /* não quebra a conexão */ }
    } catch {
      client.disconnect();
    }
  }

  // ── Desconexão — atualiza presença para offline ────────────────────────
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
      try {
        await this.usersService.update(userId, { presenceStatus: 'offline' });
        // Notifica todos via socket para atualizar o UI em tempo real
        this.server.emit('presence:update', { userId, status: 'offline' });
      } catch { /* silencioso */ }
    }
    this.socketRooms.delete(client.id);
  }

  // ── join_conversation ─────────────────────────────────────────────────────
  @SubscribeMessage('join_conversation')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.conversationId) return;

    client.join(`conv:${data.conversationId}`);
    this.socketRooms.get(client.id)?.add(data.conversationId);

    try {
      const senderIds = await this.messagesService.markConversationRead(
        data.conversationId, userId,
      );
      for (const sid of [...new Set(senderIds)]) {
        this.server.to(`user:${sid}`).emit('messages_read', {
          conversationId: data.conversationId,
        });
      }
    } catch { /* silencioso */ }
  }

  // ── leave_conversation ────────────────────────────────────────────────────
  @SubscribeMessage('leave_conversation')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conv:${data.conversationId}`);
    this.socketRooms.get(client.id)?.delete(data.conversationId);
  }

  // ── send_message ──────────────────────────────────────────────────────────
  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      content?: string;
      imageUrl?: string;
    },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return;
    if (!data.content?.trim() && !data.imageUrl) return; // nada a enviar

    // ── HARD BLOCK ──────────────────────────────────────────────────────────
    const conv = await this.convRepo.findOne({
      where: { id: data.conversationId },
      select: ['participantAId', 'participantBId'] as any,
    });
    if (!conv) return;

    const recipientId = conv.participantAId === senderId
      ? conv.participantBId
      : conv.participantAId;

    // Verifica em ambas as direções:
    // - destinatário bloqueou remetente (recipientId bloqueou senderId)
    // - remetente bloqueou destinatário (senderId bloqueou recipientId)
    const blocked = await this.blockRepo.findOne({
      where: [
        { blockerId: recipientId, blockedId: senderId },
        { blockerId: senderId,    blockedId: recipientId },
      ],
    });

    if (blocked) {
      client.emit('message_blocked', {
        conversationId: data.conversationId,
        reason: 'blocked',
      });
      return;
    }

    // ── Salvar ──────────────────────────────────────────────────────────────
    const message = await this.messagesService.sendMessage(
      senderId,
      data.conversationId,
      data.content?.trim() || '',
      data.imageUrl ?? null,
    );

    this.server.to(`conv:${data.conversationId}`).emit('new_message', message);

    // ── Delivered ──────────────────────────────────────────────────────────
    if (this.userSockets.has(recipientId)) {
      await this.messagesService.markDelivered(message.id);
      this.server.to(`user:${senderId}`).emit('message_delivered', {
        messageId: message.id,
        conversationId: data.conversationId,
      });
    }

    // ── Read (destinatário com chat aberto) ────────────────────────────────
    const roomSockets = await this.server
      .in(`conv:${data.conversationId}`)
      .fetchSockets();
    const recipientInRoom = roomSockets.some(
      s => (s as any).data?.userId === recipientId,
    );

    if (recipientInRoom) {
      const senderIds = await this.messagesService.markConversationRead(
        data.conversationId, recipientId,
      );
      if (senderIds.length) {
        this.server.to(`user:${senderId}`).emit('messages_read', {
          conversationId: data.conversationId,
        });
      }
    }
  }

  // ── typing ────────────────────────────────────────────────────────────────
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    client.to(`conv:${data.conversationId}`).emit('user_typing', {
      userId: client.data.userId,
      isTyping: data.isTyping,
    });
  }
}
