import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
    displayName?: string; bio?: string; avatarUrl?: string;
    coverUrl?: string; isPrivate?: boolean; showLikesCount?: boolean;
    showEarlyAdopterBadge?: boolean; jobTitle?: string; company?: string;
    website?: string; skills?: string[]; bannerGradient?: string;
    expoPushToken?: string | null;
    presenceStatus?: string;
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

  async getProfile(username: string, requestingUserId?: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const manager = this.userRepo.manager;

    const [followersCount, followingCount, postsCount] = await Promise.all([
      manager.count('follows', { where: { followingId: user.id } }),
      manager.count('follows', { where: { followerId: user.id } }),
      manager.count('posts',   { where: { userId: user.id, isDeleted: false } }),
    ]);

    const { password, refreshToken, ...profile } = user as any;

    if (!requestingUserId || requestingUserId === user.id) {
      return { ...profile, followersCount, followingCount, postsCount };
    }

    const [isFollowing, isFollowedBy] = await Promise.all([
      manager.count('follows', { where: { followerId: requestingUserId, followingId: user.id } }).then(n => n > 0),
      manager.count('follows', { where: { followerId: user.id, followingId: requestingUserId } }).then(n => n > 0),
    ]);

    return { ...profile, followersCount, followingCount, postsCount, isFollowing, isFollowedBy };
  }

  async search(query: string, limit = 20, requestingUserId?: string) {
    if (!query.trim()) return [];

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.username ILIKE :q OR user.displayName ILIKE :q', { q: `%${query}%` })
      .andWhere('user.isActive = true')
      .select(['user.id', 'user.username', 'user.displayName', 'user.avatarUrl', 'user.isVerified', 'user.presenceStatus'])
      .limit(limit)
      .getMany();

    if (!requestingUserId || users.length === 0) return users;

    const followedIds = await this.userRepo.manager
      .createQueryBuilder()
      .select('f.followingId')
      .from('follows', 'f')
      .where('f.followerId = :id', { id: requestingUserId })
      .getRawMany()
      .then(rows => new Set(rows.map((r: any) => r.followingId)));

    return users.map(u => ({ ...u, isFollowing: followedIds.has(u.id) }));
  }

  /**
   * Retorna o status de presença de um único usuário pelo username.
   * Fallback para 'offline' se a coluna ainda não existir.
   */
  async getUserPresence(username: string): Promise<{ userId: string; username: string; status: string }> {
    const user = await this.userRepo.findOne({
      where: { username },
      select: ['id', 'username', 'presenceStatus'] as any,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      userId:   user.id,
      username: user.username,
      status:   (user as any).presenceStatus ?? 'offline',
    };
  }

  /**
   * Retorna o status de presença de múltiplos usuários por ID (batch).
   * Limita a 50 IDs por chamada.
   */
  async getPresenceBatch(ids: string[]): Promise<{ userId: string; status: string }[]> {
    if (ids.length === 0) return [];

    const users = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'presenceStatus'] as any,
    });

    return users.map(u => ({
      userId: u.id,
      status: (u as any).presenceStatus ?? 'offline',
    }));
  }
}
