import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async like(userId: string, postId: string) {
    const existing = await this.likeRepo.findOne({ where: { userId, postId } });
    if (existing) throw new ConflictException('Já curtiu');

    const post = await this.postRepo.findOne({ where: { id: postId } });

    await this.dataSource.transaction(async manager => {
      await manager.save(Like, this.likeRepo.create({ userId, postId }));
      await manager.increment(Post, { id: postId }, 'likesCount', 1);
    });

    // Notificar dono do post
    if (post) {
      await this.notificationsService.create({
        type: NotificationType.LIKE,
        recipientId: post.userId,
        actorId: userId,
        referenceId: postId,
      });
    }

    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    const like = await this.likeRepo.findOne({ where: { userId, postId } });
    if (!like) return { liked: false };

    await this.dataSource.transaction(async manager => {
      await manager.remove(Like, like);
      await manager.decrement(Post, { id: postId }, 'likesCount', 1);
    });

    return { liked: false };
  }

  async hasLiked(userId: string, postId: string): Promise<boolean> {
    return !!(await this.likeRepo.findOne({ where: { userId, postId } }));
  }
}
