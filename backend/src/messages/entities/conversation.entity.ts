import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('conversations')
@Index(['participantAId', 'participantBId'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantAId: string;

  @Column()
  participantBId: string;

  @Column({ nullable: true })
  lastMessageId: string;

  @Column({ nullable: true })
  lastMessageAt: Date;

  /** Timestamp em que o participante A limpou a conversa.
   *  getMessages filtra mensagens com createdAt < esse valor para esse usuário. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastClearedAtA: Date | null;

  /** Idem para o participante B. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastClearedAtB: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'participantAId' })
  participantA: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'participantBId' })
  participantB: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
