import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { Story } from "./entities/story.entity";
import { StoryView } from "./entities/story-view.entity";

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly viewRepo: Repository<StoryView>,
  ) {}

  async create(userId: string, mediaUrl: string, caption?: string): Promise<Story> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const story = this.storyRepo.create({ userId, mediaUrl, caption, expiresAt });
    return this.storyRepo.save(story);
  }

  // Busca stories de quem o usuário segue + os próprios
  async getFeedStories(userId: string): Promise<any[]> {
    const now = new Date();

    // Busca todos os stories ativos agrupados por usuário
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .where("story.expiresAt > :now", { now })
      .innerJoinAndSelect("story.user", "user")
      .orderBy("story.createdAt", "DESC")
      .getMany();

    // Buscar quais stories o usuário já viu
    const views = await this.viewRepo.find({ where: { viewerId: userId } });
    const viewedIds = new Set(views.map(v => v.storyId));

    // Agrupar por usuário
    const grouped = new Map<string, any>();
    for (const story of stories) {
      const uid = story.userId;
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          user: {
            id: story.user.id,
            username: story.user.username,
            displayName: story.user.displayName,
            avatarUrl: story.user.avatarUrl,
          },
          stories: [],
          hasUnviewed: false,
          isOwn: uid === userId,
        });
      }
      const group = grouped.get(uid);
      const seen = viewedIds.has(story.id);
      group.stories.push({ ...story, viewed: seen });
      if (!seen) group.hasUnviewed = true;
    }

    // Ordenar: próprio primeiro, depois não vistos, depois vistos
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isOwn) return -1;
      if (b.isOwn) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }

  async markViewed(storyId: string, viewerId: string): Promise<void> {
    const exists = await this.viewRepo.findOne({ where: { storyId, viewerId } });
    if (!exists) {
      await this.viewRepo.save(this.viewRepo.create({ storyId, viewerId }));
      await this.storyRepo.increment({ id: storyId }, "viewsCount", 1);
    }
  }

  async getMyStories(userId: string): Promise<Story[]> {
    return this.storyRepo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: "DESC" },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.storyRepo.delete({ id, userId });
  }
}
