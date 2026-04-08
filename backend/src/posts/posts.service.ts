import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedService } from '../feed/feed.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly feedService: FeedService,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    const post = this.postRepo.create({ ...dto, userId });
    const saved = await this.postRepo.save(post);
    // fan-out assíncrono: distribui para feed dos seguidores
    await this.feedService.fanOut(saved);
    return saved;
  }

  async findById(id: string): Promise<Post> {
    const post = await this.postRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post não encontrado');
    return post;
  }

  async findByUser(username: string, page = 1, limit = 12) {
    const [posts, total] = await this.postRepo
      .createQueryBuilder('post')
      .innerJoin('post.user', 'user')
      .where('user.username = :username', { username })
      .andWhere('post.isDeleted = false')
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total, page, pages: Math.ceil(total / limit) };
  }

  async delete(id: string, userId: string): Promise<void> {
    const post = await this.findById(id);
    if (post.userId !== userId) throw new ForbiddenException();
    await this.postRepo.update(id, { isDeleted: true });
  }
}
