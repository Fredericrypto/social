import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { BlocksService } from './blocks.service';
import { BlocksController } from './blocks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Block])],
  providers: [BlocksService],
  controllers: [BlocksController],
  exports: [BlocksService],
})
export class BlocksModule {}
