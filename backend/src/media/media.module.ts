import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // usa memoryStorage (buffer) — sem disco
    }),
  ],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
