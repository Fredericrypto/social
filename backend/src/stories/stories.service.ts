import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Story } from "./entities/story.entity";
import { StoryView } from "./entities/story-view.entity";
import { MediaService } from "../media/media.service";

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(
    @InjectRepository(Story)     private readonly storyRepo: Repository<Story>,
    @InjectRepository(StoryView) private readonly viewRepo:  Repository<StoryView>,
    private readonly mediaService: MediaService,
  ) {}

  // ── Criar story ───────────────────────────────────────────────────────────
  async create(userId: string, mediaUrl: string, caption?: string, durationHours = 24): Promise<Story> {
    const hours     = [1, 6, 12, 24].includes(durationHours) ? durationHours : 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return this.storyRepo.save(
      this.storyRepo.create({ userId, mediaUrl, caption, expiresAt }),
    );
  }

  // ── Feed de stories ───────────────────────────────────────────────────────
  async getFeedStories(userId: string): Promise<any[]> {
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .where("story.expiresAt > :now", { now: new Date() })
      .innerJoinAndSelect("story.user", "user")
      .orderBy("story.createdAt", "DESC")
      .getMany();

    const views     = await this.viewRepo.find({ where: { viewerId: userId } });
    const viewedIds = new Set(views.map(v => v.storyId));

    const grouped = new Map<string, any>();
    for (const story of stories) {
      if (!grouped.has(story.userId)) {
        grouped.set(story.userId, {
          user: {
            id:          story.user.id,
            username:    story.user.username,
            displayName: story.user.displayName,
            avatarUrl:   story.user.avatarUrl,
          },
          stories:     [],
          hasUnviewed: false,
          isOwn:       story.userId === userId,
        });
      }
      const g      = grouped.get(story.userId);
      const viewed = viewedIds.has(story.id);
      g.stories.push({ ...story, viewed });
      if (!viewed) g.hasUnviewed = true;
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isOwn && !b.isOwn) return -1;
      if (!a.isOwn && b.isOwn) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }

  // ── Stories por username (perfil) ─────────────────────────────────────────
  async getStoriesByUsername(username: string, viewerId: string): Promise<any> {
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .where("story.expiresAt > :now", { now: new Date() })
      .innerJoinAndSelect("story.user", "user")
      .andWhere("user.username = :username", { username })
      .orderBy("story.createdAt", "ASC")
      .getMany();

    if (!stories.length) return { stories: [], hasUnviewed: false };

    const views     = await this.viewRepo.find({ where: { viewerId } });
    const viewedIds = new Set(views.map(v => v.storyId));
    const mapped    = stories.map(story => ({ ...story, viewed: viewedIds.has(story.id) }));
    const user      = stories[0].user;

    return {
      user: {
        id:          user.id,
        username:    user.username,
        displayName: user.displayName,
        avatarUrl:   user.avatarUrl,
      },
      stories:     mapped,
      hasUnviewed: mapped.some(s => !s.viewed),
    };
  }

  // ── Marcar visualizado ────────────────────────────────────────────────────
  async markViewed(storyId: string, viewerId: string): Promise<void> {
    const exists = await this.viewRepo.findOne({ where: { storyId, viewerId } });
    if (!exists) {
      await this.viewRepo.save(this.viewRepo.create({ storyId, viewerId }));
      await this.storyRepo.increment({ id: storyId }, "viewsCount", 1);
    }
  }

  // ── Meus stories ──────────────────────────────────────────────────────────
  async getMyStories(userId: string): Promise<Story[]> {
    return this.storyRepo.find({
      where:  { userId, expiresAt: MoreThan(new Date()) },
      order:  { createdAt: "DESC" },
    });
  }

  // ── Deletar story (manual pelo usuário) ───────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
    const story = await this.storyRepo.findOne({ where: { id, userId } });
    if (!story) return;

    // Deleta arquivo do Supabase se tiver URL
    if (story.mediaUrl) {
      const key = this.extractKeyFromUrl(story.mediaUrl);
      if (key) await this.mediaService.deleteFile(key);
    }

    // Deleta views associadas e o story
    await this.viewRepo.delete({ storyId: id });
    await this.storyRepo.delete({ id, userId });
  }

  // ── Cleanup automático — roda a cada hora ─────────────────────────────────
  // Deleta stories expirados do banco E do Supabase Storage
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredStories(): Promise<void> {
    try {
      const expired = await this.storyRepo.find({
        where: { expiresAt: LessThan(new Date()) },
      });

      if (!expired.length) return;

      this.logger.log(`🧹 Limpando ${expired.length} stories expirados...`);

      for (const story of expired) {
        // 1. Deleta arquivo do Supabase
        if (story.mediaUrl) {
          const key = this.extractKeyFromUrl(story.mediaUrl);
          if (key) {
            await this.mediaService.deleteFile(key).catch(e =>
              this.logger.warn(`Falha ao deletar arquivo ${key}: ${e.message}`)
            );
          }
        }
        // 2. Deleta views
        await this.viewRepo.delete({ storyId: story.id });
      }

      // 3. Deleta todos os stories expirados de uma vez
      await this.storyRepo.delete(
        expired.map(s => s.id).reduce((acc, id) => ({ ...acc }), {})
      );
      // Alternativa mais simples:
      await this.storyRepo
        .createQueryBuilder()
        .delete()
        .from(Story)
        .where("expiresAt < :now", { now: new Date() })
        .execute();

      this.logger.log(`✅ ${expired.length} stories expirados removidos`);
    } catch (e) {
      this.logger.error("Erro no cleanup de stories:", e.message);
    }
  }

  // ── Extrai key do Supabase a partir da URL pública ────────────────────────
  // URL formato: https://xxx.supabase.co/storage/v1/object/public/minha-rede/stories/uuid.jpg
  private extractKeyFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/object\/public\/[^/]+\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
