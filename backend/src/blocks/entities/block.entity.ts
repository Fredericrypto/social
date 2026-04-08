import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('blocks')
@Unique(['blockerId', 'blockedId'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  blockerId: string;

  @Column()
  blockedId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'blockerId' })
  blocker: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'blockedId' })
  blocked: User;

  @CreateDateColumn()
  createdAt: Date;
}
