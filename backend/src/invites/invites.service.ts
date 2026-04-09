import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invite } from './entities/invite.entity';
import { createHmac, randomUUID } from 'crypto';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    private readonly config: ConfigService,
  ) {}

  private hash(token: string): string {
    return createHmac('sha256', this.config.get('INVITE_SECRET') || 'default_secret')
      .update(token)
      .digest('hex');
  }

  async create(createdById: string, email?: string): Promise<{ token: string; invite: Invite }> {
    const token = randomUUID();
    const tokenHash = this.hash(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    const invite = this.inviteRepo.create({ tokenHash, email, createdById, expiresAt });
    await this.inviteRepo.save(invite);

    return { token, invite }; // token puro só retorna aqui, NUNCA é armazenado
  }

  async validate(token: string): Promise<Invite> {
    const tokenHash = this.hash(token);
    const invite = await this.inviteRepo.findOne({ where: { tokenHash } });

    if (!invite) throw new NotFoundException('Convite inválido');
    if (invite.isUsed) throw new BadRequestException('Convite já utilizado');
    if (invite.expiresAt && invite.expiresAt < new Date())
      throw new BadRequestException('Convite expirado');

    return invite;
  }

  async use(token: string): Promise<void> {
    const invite = await this.validate(token);
    await this.inviteRepo.update(invite.id, { isUsed: true });
  }

  async getMyInvites(userId: string) {
    return this.inviteRepo.find({
      where: { createdById: userId },
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'isUsed', 'expiresAt', 'createdAt'],
    });
  }
}
