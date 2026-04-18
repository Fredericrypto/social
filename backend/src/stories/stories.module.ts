import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { Story } from "./entities/story.entity";
import { StoryView } from "./entities/story-view.entity";
import { StoriesService } from "./stories.service";
import { StoriesController } from "./stories.controller";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryView]),
    MediaModule, // para deletar arquivos do Supabase
  ],
  providers: [StoriesService],
  controllers: [StoriesController],
  exports: [StoriesService],
})
export class StoriesModule {}
