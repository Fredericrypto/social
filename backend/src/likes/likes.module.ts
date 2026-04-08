import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Post]), NotificationsModule],
  providers: [LikesService],
  controllers: [LikesController],
})
export class LikesModule {}
