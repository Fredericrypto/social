import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedItem } from './entities/feed.entity';
import { Follow } from '../follows/entities/follow.entity';
import { Post } from '../posts/entities/post.entity';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedItem)
    private readonly feedRepo: Repository<FeedItem>,
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async fanOut(post: Post): Promise<void> {
    const followers = await this.followRepo.find({
      where: { followingId: post.userId },
      select: ['followerId'],
    });

    if (!followers.length) return;

    const feedItems = followers.map(f =>
      this.feedRepo.create({
        userId: f.followerId,
        postId: post.id,
        authorId: post.userId,
      }),
    );

    await this.feedRepo
      .createQueryBuilder()
      .insert()
      .into(FeedItem)
      .values(feedItems)
      .orIgnore()
      .execute();
  }

  async getFeed(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.feedRepo
      .createQueryBuilder('feed')
      .where('feed.userId = :userId', { userId })
      .innerJoinAndSelect('feed.post', 'post')
      .innerJoin('post.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl', 'user.isVerified'])
      .andWhere('post.isDeleted = false')
      .orderBy('feed.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      posts: items.map(i => ({ ...i.post, feedCreatedAt: i.createdAt })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
