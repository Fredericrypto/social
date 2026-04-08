import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(data: {
    type: NotificationType;
    recipientId: string;
    actorId: string;
    referenceId?: string;
  }): Promise<void> {
    // Não notifica a si mesmo
    if (data.recipientId === data.actorId) return;
    const notif = this.notifRepo.create(data);
    await this.notifRepo.save(notif);
  }

  async getUnread(userId: string) {
    return this.notifRepo
      .createQueryBuilder('n')
      .where('n.recipientId = :userId', { userId })
      .andWhere('n.isRead = false')
      .orderBy('n.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  async getAll(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.notifRepo
      .createQueryBuilder('n')
      .where('n.recipientId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { notifications: items, total, page };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ recipientId: userId, isRead: false }, { isRead: true });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notifRepo.update({ id, recipientId: userId }, { isRead: true });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { recipientId: userId, isRead: false } });
  }
}
