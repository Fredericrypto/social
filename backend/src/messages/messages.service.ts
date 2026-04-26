import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageReaction } from './entities/message.entity';
import { Block } from '../blocks/entities/block.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    @InjectRepository(Block)
    private readonly blockRepo: Repository<Block>,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreateConversation(userAId: string, userBId: string): Promise<Conversation> {
    const [a, b] = [userAId, userBId].sort();
    let conv = await this.convRepo.findOne({ where: { participantAId: a, participantBId: b } });
    if (!conv) {
      conv = this.convRepo.create({ participantAId: a, participantBId: b });
      await this.convRepo.save(conv);
    }
    return conv;
  }

  async getConversations(userId: string) {
    const convs = await this.convRepo
      .createQueryBuilder('conv')
      .where('conv.participantAId = :id OR conv.participantBId = :id', { id: userId })
      .leftJoinAndSelect('conv.participantA', 'pA')
      .leftJoinAndSelect('conv.participantB', 'pB')
      .orderBy('conv.lastMessageAt', 'DESC', 'NULLS LAST')
      .getMany();

    // Buscar lastMessage e unreadCount para cada conversa
    const enriched = await Promise.all(convs.map(async c => {
      // lastMessage
      let lastMessage = null;
      if (c.lastMessageId) {
        lastMessage = await this.msgRepo.findOne({
          where: { id: c.lastMessageId },
          select: ['id', 'content', 'imageUrl', 'senderId', 'createdAt', 'isRead'],
        });
      }
      // unreadCount — mensagens não lidas do outro participante
      const unreadCount = await this.msgRepo.count({
        where: {
          conversationId: c.id,
          senderId: c.participantAId === userId ? c.participantBId : c.participantAId,
          isRead: false,
          isDeleted: false,
        },
      });
      return {
        ...c,
        participantA:  this.sanitizeUser(c.participantA),
        participantB:  this.sanitizeUser(c.participantB),
        lastMessage,
        unreadCount,
      };
    }));

    return enriched;
  }

  async getMessages(conversationId: string, userId: string, page = 1, limit = 30) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();

    const isA = conv.participantAId === userId;
    const clearedAt = isA ? conv.lastClearedAtA : conv.lastClearedAtB;

    const qb = this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.conversationId = :id', { id: conversationId })
      .andWhere('msg.isDeleted = false')
      .leftJoinAndSelect('msg.sender', 'sender')
      .orderBy('msg.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (clearedAt) {
      qb.andWhere('msg.createdAt > :clearedAt', { clearedAt });
    }

    const [messages, total] = await qb.getManyAndCount();
    return {
      messages: messages.reverse().map(m => ({ ...m, sender: this.sanitizeUser(m.sender) })),
      total, page,
    };
  }

  async sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
    imageUrl?: string | null,
  ): Promise<Message> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== senderId && conv.participantBId !== senderId)
      throw new ForbiddenException();

    // Hard block — verificar em ambas as direções
    const recipientId = conv.participantAId === senderId
      ? conv.participantBId
      : conv.participantAId;

    const blocked = await this.blockRepo.findOne({
      where: [
        { blockerId: recipientId, blockedId: senderId },
        { blockerId: senderId,    blockedId: recipientId },
      ],
    });
    if (blocked) throw new ForbiddenException('blocked');

    let message: Message;
    await this.dataSource.transaction(async manager => {
      message = await manager.save(
        Message,
        this.msgRepo.create({ content: content || '', imageUrl: imageUrl ?? null, senderId, conversationId }),
      );
      await manager.update(Conversation, conversationId, {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
      });
    });
    return message!;
  }

  /**
   * Reagir a uma mensagem — estilo Telegram.
   * Cada usuário pode ter UMA reação por vez por mensagem.
   * Múltiplos usuários podem reagir com emojis diferentes.
   * Reagir com o mesmo emoji remove a reação (toggle).
   */
  async reactToMessage(
    messageId: string,
    userId: string,
    emoji: string | null,
  ): Promise<{ reactions: MessageReaction[] }> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();

    const conv = await this.convRepo.findOne({ where: { id: msg.conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();

    // Hard block — reações também bloqueadas em ambas as direções
    const recipientId = conv.participantAId === userId
      ? conv.participantBId
      : conv.participantAId;
    const blocked = await this.blockRepo.findOne({
      where: [
        { blockerId: recipientId, blockedId: userId },
        { blockerId: userId,      blockedId: recipientId },
      ],
    });
    if (blocked) throw new ForbiddenException('blocked');

    // Clonar array atual ou iniciar vazio
    let reactions: MessageReaction[] = Array.isArray(msg.reactions) ? [...msg.reactions] : [];

    if (!emoji) {
      // Remover reação do userId
      reactions = reactions.filter(r => r.userId !== userId);
    } else {
      const existing = reactions.find(r => r.userId === userId);
      if (existing) {
        if (existing.emoji === emoji) {
          // Toggle: mesmo emoji → remover
          reactions = reactions.filter(r => r.userId !== userId);
        } else {
          // Trocar emoji
          existing.emoji = emoji;
        }
      } else {
        // Nova reação
        reactions.push({ emoji, userId });
      }
    }

    const finalReactions = reactions.length > 0 ? reactions : null;
    await this.msgRepo.update(messageId, { reactions: finalReactions });
    return { reactions: finalReactions ?? [] };
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    const conv = await this.convRepo.findOne({ where: { id: msg.conversationId } });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();
    await this.msgRepo.update(messageId, { isDeleted: true });
  }

  async markDelivered(messageId: string): Promise<void> {
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ deliveredAt: new Date() })
      .where('id = :id AND "deliveredAt" IS NULL', { id: messageId })
      .execute();
  }

  async markConversationRead(conversationId: string, readerId: string): Promise<string[]> {
    const unread = await this.msgRepo.find({
      where: { conversationId, isRead: false, senderId: Not(readerId) },
      select: ['id', 'senderId'],
    });
    if (!unread.length) return [];
    const ids = unread.map(m => m.id);
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true, deliveredAt: () => 'COALESCE("deliveredAt", NOW())' })
      .whereInIds(ids)
      .execute();
    return unread.map(m => m.senderId);
  }

  async clearConversation(conversationId: string, userId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();
    const isA = conv.participantAId === userId;
    await this.convRepo.update(conversationId, {
      ...(isA ? { lastClearedAtA: new Date() } : { lastClearedAtB: new Date() }),
    });
  }

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

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}
