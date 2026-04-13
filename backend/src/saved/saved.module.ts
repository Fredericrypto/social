import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedPost } from './saved.entity';
import { Post } from '../posts/entities/post.entity';
import { SavedService } from './saved.service';
import { SavedController } from './saved.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPost, Post])],
  providers: [SavedService],
  controllers: [SavedController],
  exports: [SavedService],
})
export class SavedModule {}
