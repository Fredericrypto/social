import { Controller, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    return this.sanitize(user);
  }

  @Get(':username')
  getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMe(@Request() req, @Body() body: any) {
    const { password, email, refreshToken, ...safe } = body;
    const user = await this.usersService.update(req.user.id, safe);
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    const { password, refreshToken, ...safe } = user;
    return safe;
  }
}
