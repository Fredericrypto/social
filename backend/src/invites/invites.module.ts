import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invite])],
  providers: [InvitesService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
