import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, Index, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('posts')
@Index(['userId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  caption: string;

  @Column('text', { array: true, default: [] })
  mediaUrls: string[];

  @Column({ default: 'image' })
  mediaType: string;

  @Column({ default: 0 })
  likesCount: number;

  @Column({ default: 0 })
  commentsCount: number;

  @Column({ default: false })
  isDeleted: boolean;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
