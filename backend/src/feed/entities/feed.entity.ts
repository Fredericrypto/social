import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

@Entity('feed')
@Index(['userId', 'createdAt'])
export class FeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column()
  postId: string;

  @Column()
  authorId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
