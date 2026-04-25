import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, MoreThan } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Criar / buscar conversa ──────────────────────────────────────────────
  async getOrCreateConversation(userAId: string, userBId: string): Promise<Conversation> {
    const [a, b] = [userAId, userBId].sort();
    let conv = await this.convRepo.findOne({
      where: { participantAId: a, participantBId: b },
    });
    if (!conv) {
      conv = this.convRepo.create({ participantAId: a, participantBId: b });
      await this.convRepo.save(conv);
    }
    return conv;
  }

  // ── Listar conversas ─────────────────────────────────────────────────────
  async getConversations(userId: string) {
    return this.convRepo
      .createQueryBuilder('conv')
      .where('conv.participantAId = :id OR conv.participantBId = :id', { id: userId })
      .leftJoinAndSelect('conv.participantA', 'pA')
      .leftJoinAndSelect('conv.participantB', 'pB')
      .orderBy('conv.lastMessageAt', 'DESC', 'NULLS LAST')
      .getMany()
      .then(convs => convs.map(c => ({
        ...c,
        participantA: this.sanitizeUser(c.participantA),
        participantB: this.sanitizeUser(c.participantB),
      })));
  }

  // ── Buscar mensagens (respeita lastClearedAt por usuário) ────────────────
  async getMessages(conversationId: string, userId: string, page = 1, limit = 30) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();

    // Descobrir o timestamp de limpeza para este usuário
    const isA = conv.participantAId === userId;
    const clearedAt: Date | null = isA ? conv.lastClearedAtA : conv.lastClearedAtB;

    const qb = this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.conversationId = :id', { id: conversationId })
      .andWhere('msg.isDeleted = false')
      .leftJoinAndSelect('msg.sender', 'sender')
      .orderBy('msg.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filtrar mensagens anteriores à última limpeza do usuário
    if (clearedAt) {
      qb.andWhere('msg.createdAt > :clearedAt', { clearedAt });
    }

    const [messages, total] = await qb.getManyAndCount();

    // Marcar recebidas como lidas e coletar senderIds para notificar
    const senderIds = await this.markConversationRead(conversationId, userId);

    return {
      messages: messages.reverse().map(m => ({
        ...m,
        sender: this.sanitizeUser(m.sender),
      })),
      total,
      page,
      // Retorna senderIds para o controller/gateway poder emitir 'messages_read'
      readNotify: senderIds,
    };
  }

  // ── Enviar mensagem ──────────────────────────────────────────────────────
  async sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ): Promise<Message> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== senderId && conv.participantBId !== senderId)
      throw new ForbiddenException();

    let message: Message;
    await this.dataSource.transaction(async manager => {
      message = await manager.save(
        Message,
        this.msgRepo.create({ content, senderId, conversationId }),
      );
      await manager.update(Conversation, conversationId, {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
      });
    });

    return message!;
  }

  // ── Marcar mensagem como entregue ────────────────────────────────────────
  // Chamado pelo gateway quando o destinatário está conectado mas
  // não necessariamente com a conversa aberta.
  async markDelivered(messageId: string): Promise<void> {
    await this.msgRepo.update(
      { id: messageId, deliveredAt: undefined },
      { deliveredAt: new Date() },
    );
  }

  // ── Marcar conversa como lida ────────────────────────────────────────────
  // Retorna senderIds das mensagens que foram marcadas (para emitir socket).
  async markConversationRead(
    conversationId: string,
    readerId: string,
  ): Promise<string[]> {
    const unread = await this.msgRepo.find({
      where: {
        conversationId,
        isRead: false,
        senderId: Not(readerId),
      },
      select: ['id', 'senderId'],
    });

    if (!unread.length) return [];

    const ids = unread.map(m => m.id);
    await this.msgRepo.update(ids, {
      isRead: true,
      deliveredAt: () => 'COALESCE("deliveredAt", NOW())', // garante deliveredAt preenchido
    });

    return unread.map(m => m.senderId);
  }

  // ── Limpar conversa (persistente) ────────────────────────────────────────
  // Define lastClearedAt para o usuário que pediu a limpeza.
  // As mensagens NÃO são deletadas do DB — apenas ficam invisíveis para
  // este usuário. O outro participante continua vendo o histórico.
  async clearConversation(conversationId: string, userId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();

    const isA = conv.participantAId === userId;
    await this.convRepo.update(conversationId, {
      ...(isA
        ? { lastClearedAtA: new Date() }
        : { lastClearedAtB: new Date() }),
    });
  }

  // ── Unread count ─────────────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    const convs = await this.convRepo.find({
      where: [{ participantAId: userId }, { participantBId: userId }],
    });
    if (!convs.length) return 0;
    const ids = convs.map(c => c.id);
    return this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.conversationId IN (:...ids)', { ids })
      .andWhere('msg.senderId != :userId', { userId })
      .andWhere('msg.isRead = false')
      .getCount();
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  private sanitizeUser(user: any) {
    if (!user) return null;
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}
