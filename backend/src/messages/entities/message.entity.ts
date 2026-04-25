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

  @Column('text')
  content: string;

  @Column()
  senderId: string;

  @Column()
  conversationId: string;

  /** null = só enviado ao servidor (1 check slate)
   *  preenchido = entregue ao dispositivo (2 checks slate)  */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  deliveredAt: Date | null;

  /** false = não lido / true = lido (2 checks cyan) */
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
