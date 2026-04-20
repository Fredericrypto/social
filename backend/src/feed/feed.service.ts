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
        userId:   f.followerId,
        postId:   post.id,
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
      .addSelect([
        'user.id', 'user.username', 'user.displayName',
        'user.avatarUrl', 'user.isVerified', 'user.presenceStatus',
      ])
      .andWhere('post.isDeleted = false')
      .orderBy('feed.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (items.length === 0) {
      return { posts: [], total: 0, page, pages: 0 };
    }

    const postIds = items.map(i => i.post.id);

    const likedRows = await this.feedRepo.manager
      .createQueryBuilder()
      .select('l.postId')
      .from('likes', 'l')
      .where('l.userId = :userId', { userId })
      .andWhere('l.postId IN (:...ids)', { ids: postIds })
      .getRawMany();

    const likedSet = new Set(likedRows.map((r: any) => r.l_postId ?? r.postId));

    const savedRows = await this.feedRepo.manager
      .createQueryBuilder()
      .select('s.postId')
      .from('saved_posts', 's')
      .where('s.userId = :userId', { userId })
      .andWhere('s.postId IN (:...ids)', { ids: postIds })
      .getRawMany()
      .catch(() => []);

    const savedSet = new Set(savedRows.map((r: any) => r.s_postId ?? r.postId));

    return {
      posts: items.map(i => ({
        ...i.post,
        feedCreatedAt: i.createdAt,
        isLiked: likedSet.has(i.post.id),
        isSaved: savedSet.has(i.post.id),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
