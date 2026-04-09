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
