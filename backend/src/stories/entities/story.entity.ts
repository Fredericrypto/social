import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("stories")
@Index(["userId", "createdAt"])
export class Story {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  mediaUrl: string;

  @Column({ default: "image" })
  mediaType: string;

  @Column({ nullable: true })
  caption: string;

  @Column({ default: 0 })
  viewsCount: number;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
