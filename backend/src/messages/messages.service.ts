import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

  async getMessages(conversationId: string, userId: string, page = 1, limit = 30) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== userId && conv.participantBId !== userId)
      throw new ForbiddenException();

    const [messages, total] = await this.msgRepo
      .createQueryBuilder('msg')
      .where('msg.conversationId = :id', { id: conversationId })
      .andWhere('msg.isDeleted = false')
      .leftJoinAndSelect('msg.sender', 'sender')
      .orderBy('msg.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Marcar como lidas
    await this.msgRepo.update(
      { conversationId, isRead: false },
      { isRead: true },
    );

    return {
      messages: messages.reverse().map(m => ({
        ...m,
        sender: this.sanitizeUser(m.sender),
      })),
      total, page,
    };
  }

  async sendMessage(senderId: string, conversationId: string, content: string): Promise<Message> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();
    if (conv.participantAId !== senderId && conv.participantBId !== senderId)
      throw new ForbiddenException();

    let message: Message;
    await this.dataSource.transaction(async manager => {
      message = await manager.save(Message,
        this.msgRepo.create({ content, senderId, conversationId })
      );
      await manager.update(Conversation, conversationId, {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
      });
    });

    return message!;
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
