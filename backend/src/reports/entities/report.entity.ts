import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  INAPPROPRIATE = 'inappropriate',
  FAKE = 'fake',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ nullable: true })
  description: string;

  @Column()
  reporterId: string;

  @Column({ nullable: true })
  postId: string;

  @Column({ nullable: true })
  reportedUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @CreateDateColumn()
  createdAt: Date;
}
