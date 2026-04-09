import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: [{ email: data.email }, { username: data.username }],
    });
    if (existing) throw new ConflictException('Email ou username já em uso');
    if (data.password) data.password = await bcrypt.hash(data.password, 12);
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { googleId } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async updateProfile(id: string, data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    isPrivate?: boolean;
  }): Promise<any> {
    await this.userRepo.update(id, data);
    const user = await this.findById(id);
    const { password, refreshToken, ...safe } = user as any;
    return safe;
  }

  async updateRefreshToken(id: string, token: string | null): Promise<void> {
    const hashed = token ? await bcrypt.hash(token, 10) : null;
    await this.userRepo.update(id, { refreshToken: hashed });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async getProfile(username: string) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .loadRelationCountAndMap('user.followersCount', 'user.followers')
      .loadRelationCountAndMap('user.followingCount', 'user.following')
      .loadRelationCountAndMap('user.postsCount', 'user.posts')
      .getOne();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { password, refreshToken, ...profile } = user as any;
    return profile;
  }
}
