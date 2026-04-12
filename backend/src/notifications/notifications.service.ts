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
    if (data.recipientId === data.actorId) return;
    const notif = this.notifRepo.create(data);
    await this.notifRepo.save(notif);
  }

  async getAll(userId: string, page = 1, limit = 20) {
    const notifications = await this.notifRepo
      .createQueryBuilder('n')
      .leftJoin('users', 'actor', 'actor.id = n."actorId"::uuid')
      .addSelect([
        'actor.id',
        'actor.username',
        'actor.displayName',
        'actor.avatarUrl',
      ])
      .where('n.recipientId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    const total = await this.notifRepo.count({ where: { recipientId: userId } });

    const result = notifications.entities.map((n, i) => ({
      ...n,
      actor: {
        id: notifications.raw[i]?.actor_id,
        username: notifications.raw[i]?.actor_username,
        displayName: notifications.raw[i]?.actor_displayName,
        avatarUrl: notifications.raw[i]?.actor_avatarUrl,
      },
    }));

    return { notifications: result, total, page };
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
