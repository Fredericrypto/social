import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedItem } from './entities/feed.entity';
import { Follow } from '../follows/entities/follow.entity';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeedItem, Follow])],
  providers: [FeedService],
  controllers: [FeedController],
  exports: [FeedService],
})
export class FeedModule {}
