import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, Index, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MENTION = 'mention',
}

@Entity('notifications')
@Index(['recipientId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column()
  recipientId: string;

  @Column()
  actorId: string;

  @Column({ nullable: true })
  referenceId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @CreateDateColumn()
  createdAt: Date;
}
