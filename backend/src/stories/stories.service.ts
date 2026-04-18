import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { Story } from "./entities/story.entity";
import { StoryView } from "./entities/story-view.entity";

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story) private readonly storyRepo: Repository<Story>,
    @InjectRepository(StoryView) private readonly viewRepo: Repository<StoryView>,
  ) {}

  // durationHours: 1 | 6 | 12 | 24 — padrão 24h
  async create(userId: string, mediaUrl: string, caption?: string, durationHours = 24): Promise<Story> {
    const hours = [1, 6, 12, 24].includes(durationHours) ? durationHours : 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return this.storyRepo.save(this.storyRepo.create({ userId, mediaUrl, caption, expiresAt }));
  }

  async getFeedStories(userId: string): Promise<any[]> {
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .where("story.expiresAt > :now", { now: new Date() })
      .innerJoinAndSelect("story.user", "user")
      .orderBy("story.createdAt", "DESC")
      .getMany();

    const views = await this.viewRepo.find({ where: { viewerId: userId } });
    const viewedIds = new Set(views.map(v => v.storyId));

    const grouped = new Map<string, any>();
    for (const story of stories) {
      if (!grouped.has(story.userId)) {
        grouped.set(story.userId, {
          user: { id: story.user.id, username: story.user.username, displayName: story.user.displayName, avatarUrl: story.user.avatarUrl },
          stories: [],
          hasUnviewed: false,
          isOwn: story.userId === userId,
        });
      }
      const g = grouped.get(story.userId);
      const viewed = viewedIds.has(story.id);
      g.stories.push({ ...story, viewed });
      if (!viewed) g.hasUnviewed = true;
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isOwn) return -1;
      if (b.isOwn) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }

  async getStoriesByUsername(username: string, viewerId: string): Promise<any> {
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .where("story.expiresAt > :now", { now: new Date() })
      .innerJoinAndSelect("story.user", "user")
      .andWhere("user.username = :username", { username })
      .orderBy("story.createdAt", "ASC")
      .getMany();

    if (!stories.length) return { stories: [], hasUnviewed: false };

    const views = await this.viewRepo.find({ where: { viewerId } });
    const viewedIds = new Set(views.map(v => v.storyId));

    const mapped = stories.map(story => ({ ...story, viewed: viewedIds.has(story.id) }));
    const hasUnviewed = mapped.some(s => !s.viewed);
    const user = stories[0].user;

    return {
      user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
      stories: mapped,
      hasUnviewed,
    };
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
