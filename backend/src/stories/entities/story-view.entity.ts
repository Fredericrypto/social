import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  Unique,
} from "typeorm";

@Entity("story_views")
@Unique(["storyId", "viewerId"])
export class StoryView {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  storyId: string;

  @Column()
  viewerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
