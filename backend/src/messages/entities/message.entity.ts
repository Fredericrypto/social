import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Texto da mensagem — vazio se for só imagem */
  @Column({ type: 'text', default: '' })
  content: string;

  /** URL da imagem no Supabase Storage (bucket: messages) */
  @Column({ type: 'text', nullable: true, default: null })
  imageUrl: string | null;

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
