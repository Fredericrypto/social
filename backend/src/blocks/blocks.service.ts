import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from './entities/block.entity';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Block)
    private readonly blockRepo: Repository<Block>,
  ) {}

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new ConflictException('Não pode bloquear a si mesmo');
    const existing = await this.blockRepo.findOne({ where: { blockerId, blockedId } });
    if (existing) throw new ConflictException('Já bloqueado');
    const block = this.blockRepo.create({ blockerId, blockedId });
    return this.blockRepo.save(block);
  }

  async unblock(blockerId: string, blockedId: string) {
    const block = await this.blockRepo.findOne({ where: { blockerId, blockedId } });
    if (!block) throw new NotFoundException('Bloqueio não encontrado');
    await this.blockRepo.remove(block);
    return { unblocked: true };
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.blockRepo.findOne({ where: { blockerId, blockedId } });
    return !!block;
  }

  async getBlockedUsers(userId: string) {
    return this.blockRepo.find({
      where: { blockerId: userId },
      relations: ['blocked'],
      select: { blocked: { id: true, username: true, displayName: true, avatarUrl: true } },
    });
  }
}
