import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ConflictException('Você não pode seguir a si mesmo');

    const existing = await this.followRepo.findOne({ where: { followerId, followingId } });
    if (existing) throw new ConflictException('Já está seguindo');

    const follow = this.followRepo.create({ followerId, followingId });
    return this.followRepo.save(follow);
  }

  async unfollow(followerId: string, followingId: string) {
    const follow = await this.followRepo.findOne({ where: { followerId, followingId } });
    if (!follow) throw new NotFoundException('Não está seguindo');
    await this.followRepo.remove(follow);
    return { message: 'Deixou de seguir' };
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.followRepo
      .createQueryBuilder('follow')
      .where('follow.followingId = :userId', { userId })
      .innerJoinAndSelect('follow.follower', 'user')
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users: items.map(i => this.sanitize(i.follower)), total };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.followRepo
      .createQueryBuilder('follow')
      .where('follow.followerId = :userId', { userId })
      .innerJoinAndSelect('follow.following', 'user')
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users: items.map(i => this.sanitize(i.following)), total };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followRepo.findOne({ where: { followerId, followingId } });
    return !!follow;
  }

  private sanitize(user: any) {
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}
