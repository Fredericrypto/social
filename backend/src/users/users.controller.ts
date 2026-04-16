import {
  Controller, Get, Patch, Body, Param, Query,
  UseGuards, Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  IsOptional, IsString, IsBoolean, IsArray,
  IsIn, IsInt, Min, Max,
} from "class-validator";

class UpdateProfileDto {
  @IsOptional() @IsString()  displayName?:          string;
  @IsOptional() @IsString()  bio?:                  string;
  @IsOptional() @IsString()  avatarUrl?:            string;
  @IsOptional() @IsString()  coverUrl?:             string;
  @IsOptional() @IsBoolean() isPrivate?:            boolean;
  @IsOptional() @IsString()  jobTitle?:             string;
  @IsOptional() @IsString()  company?:              string;
  @IsOptional() @IsString()  website?:              string;
  @IsOptional() @IsArray()   skills?:               string[];
  @IsOptional() @IsBoolean() showLikesCount?:       boolean;
  @IsOptional() @IsIn(["everyone", "followers", "nobody"]) whoCanMessage?: string;
  @IsOptional() @IsString()  bannerGradient?:       string;

  // Early Adopter Badge
  @IsOptional() @IsBoolean() showEarlyAdopterBadge?: boolean;

  // Push Notifications
  @IsOptional() @IsString()  expoPushToken?:        string | null;
}

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    const { password, refreshToken, ...safe } = user as any;
    return safe;
  }

  @Get("search")
  search(@Query("q") q: string) {
    return this.usersService.search(q || "");
  }

  @Get(":username")
  getProfile(@Param("username") username: string) {
    return this.usersService.getProfile(username);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMe(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}
