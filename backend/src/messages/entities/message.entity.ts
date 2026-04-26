import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';

export interface MessageReaction {
  emoji:  string;
  userId: string;
}

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'text', nullable: true, default: null })
  imageUrl: string | null;

  /**
   * Array de reações. Cada user pode ter UMA reação por vez.
   * Múltiplos emojis diferentes são permitidos (estilo Telegram).
   * Ex: [{ emoji: '❤️', userId: 'abc' }, { emoji: '😂', userId: 'def' }]
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  reactions: MessageReaction[] | null;

  @Column()
  senderId: string;

  @Column()
  conversationId: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deliveredAt: Date | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @CreateDateColumn()
  createdAt: Date;
}
