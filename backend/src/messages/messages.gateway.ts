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

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/messages' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // userId → socketId
  private userSockets = new Map<string, string>();
  // socketId → Set<conversationId>
  private socketRooms = new Map<string, Set<string>>();

  constructor(
    private readonly messagesService: MessagesService,
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
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) this.userSockets.delete(client.data.userId);
    this.socketRooms.delete(client.id);
  }

  // ── join_conversation ─────────────────────────────────────────────────────
  // Ao entrar na conversa:
  //  1. Entra na sala Socket.io
  //  2. Marca mensagens recebidas como lidas
  //  3. Notifica remetentes via 'messages_read'
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
        data.conversationId,
        userId,
      );
      const unique = [...new Set(senderIds)];
      for (const sid of unique) {
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
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId || !data.content?.trim()) return;

    // ── HARD BLOCK ──────────────────────────────────────────────────────────
    // Descobrir quem é o destinatário desta conversa
    const conv = await this.convRepo.findOne({
      where: { id: data.conversationId },
      select: ['participantAId', 'participantBId'],
    });
    if (!conv) return;

    const recipientId =
      conv.participantAId === senderId
        ? conv.participantBId
        : conv.participantAId;

    // Checar se o destinatário bloqueou o remetente
    const blocked = await this.blockRepo.findOne({
      where: { blockerId: recipientId, blockedId: senderId },
    });

    if (blocked) {
      // Rejeita silenciosamente — envia erro só para o remetente
      client.emit('message_blocked', {
        conversationId: data.conversationId,
        reason: 'blocked',
      });
      return;
    }

    // ── Salvar e emitir ─────────────────────────────────────────────────────
    const message = await this.messagesService.sendMessage(
      senderId,
      data.conversationId,
      data.content.trim(),
    );

    // Emitir para todos na sala (inclui o remetente — confirmação de envio)
    this.server
      .to(`conv:${data.conversationId}`)
      .emit('new_message', message);

    // ── Delivered ──────────────────────────────────────────────────────────
    // Se o destinatário está CONECTADO (mesmo que não esteja na sala da conversa),
    // marcar como entregue imediatamente e notificar o remetente.
    const recipientSocketId = this.userSockets.get(recipientId);
    if (recipientSocketId) {
      await this.messagesService.markDelivered(message.id);
      // Notifica o remetente: este check específico virou 2 checks slate
      this.server.to(`user:${senderId}`).emit('message_delivered', {
        messageId: message.id,
        conversationId: data.conversationId,
      });
    }

    // ── Read ───────────────────────────────────────────────────────────────
    // Se o destinatário está com a conversa ABERTA (está na sala),
    // a mensagem já foi lida — marcar e notificar.
    const roomSockets = await this.server
      .in(`conv:${data.conversationId}`)
      .fetchSockets();
    const recipientInRoom = roomSockets.some(
      s => (s as any).data?.userId === recipientId,
    );

    if (recipientInRoom) {
      const senderIds = await this.messagesService.markConversationRead(
        data.conversationId,
        recipientId,
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
