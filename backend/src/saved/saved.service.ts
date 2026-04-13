import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPost } from './saved.entity';

@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedPost)
    private readonly savedRepo: Repository<SavedPost>,
  ) {}

  async save(userId: string, postId: string) {
    const existing = await this.savedRepo.findOne({ where: { userId, postId } });
    if (existing) return { saved: true };
    await this.savedRepo.save(this.savedRepo.create({ userId, postId }));
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.savedRepo.delete({ userId, postId });
    return { saved: false };
  }

  async isSaved(userId: string, postId: string): Promise<boolean> {
    return !!(await this.savedRepo.findOne({ where: { userId, postId } }));
  }

  async getMySaved(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.savedRepo
      .createQueryBuilder('s')
      .where('s.userId = :userId', { userId })
      .leftJoinAndSelect('s.post', 'post')
      .leftJoinAndSelect('post.user', 'user')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      posts: items.map(i => i.post).filter(Boolean),
      total,
      page,
    };
  }
}
