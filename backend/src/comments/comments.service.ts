import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, postId: string, dto: CreateCommentDto) {
    let comment: Comment;
    const post = await this.postRepo.findOne({ where: { id: postId } });
    await this.dataSource.transaction(async manager => {
      comment = await manager.save(Comment, this.commentRepo.create({ ...dto, userId, postId }));
      await manager.increment(Post, { id: postId }, 'commentsCount', 1);
    });
    if (post) {
      await this.notificationsService.create({
        type: NotificationType.COMMENT,
        recipientId: post.userId,
        actorId: userId,
        referenceId: postId,
      });
    }
    return comment!;
  }

  async findByPost(postId: string, page = 1, limit = 20) {
    const [comments, total] = await this.commentRepo
      .createQueryBuilder('comment')
      .where('comment.postId = :postId', { postId })
      .andWhere('comment.parentId IS NULL')
      .innerJoinAndSelect('comment.user', 'user')
      .orderBy('comment.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { comments, total, page };
  }

  async delete(id: string, userId: string) {
    const comment = await this.commentRepo.findOne({ where: { id, userId } });
    if (!comment) return;
    await this.dataSource.transaction(async manager => {
      await manager.remove(Comment, comment);
      await manager.decrement(Post, { id: comment.postId }, 'commentsCount', 1);
    });
    return { deleted: true };
  }
}
