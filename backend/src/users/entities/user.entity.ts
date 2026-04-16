import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Index({ unique: true })
  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  coverUrl: string;

  @Column({ nullable: true })
  jobTitle: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  website: string;

  @Column('text', { array: true, default: [] })
  skills: string[];

  @Column({ nullable: true })
  bannerGradient: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ default: true })
  showLikesCount: boolean;

  // ── Presença ─────────────────────────────────────────────────────────────
  // Status manual: online | busy | away | offline
  @Column({ default: "offline", type: "varchar", length: 20 })
  presenceStatus: string;

  // ── Early Adopter Badge ──────────────────────────────────────────────────
  // Número de inscrição (1–1000). NULL = não é early adopter.
  // Atribuído automaticamente pelo trigger PostgreSQL na criação do usuário.
  @Column({ nullable: true, type: 'int', unique: true })
  earlyAdopterNumber: number | null;

  // Preferência de exibição da badge no perfil
  @Column({ default: true })
  showEarlyAdopterBadge: boolean;

  // ── Push Notifications ───────────────────────────────────────────────────
  // Token Expo Push — registrado pelo app após permissão concedida
  @Column({ nullable: true, type: 'text' })
  expoPushToken: string | null;

  @Column({ nullable: true, type: 'text' })
  refreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
