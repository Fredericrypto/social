import {
  Controller, Get, Patch, Body, Param, Query,
  UseGuards, Request, Optional,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtGuard } from "../auth/guards/optional-jwt.guard";
import {
  IsOptional, IsString, IsBoolean, IsArray, IsIn,
} from "class-validator";

class UpdateProfileDto {
  @IsOptional() @IsString()  displayName?:           string;
  @IsOptional() @IsString()  bio?:                   string;
  @IsOptional() @IsString()  avatarUrl?:             string;
  @IsOptional() @IsString()  coverUrl?:              string;
  @IsOptional() @IsBoolean() isPrivate?:             boolean;
  @IsOptional() @IsString()  jobTitle?:              string;
  @IsOptional() @IsString()  company?:               string;
  @IsOptional() @IsString()  website?:               string;
  @IsOptional() @IsArray()   skills?:                string[];
  @IsOptional() @IsBoolean() showLikesCount?:        boolean;
  @IsOptional() @IsIn(["everyone", "followers", "nobody"]) whoCanMessage?: string;
  @IsOptional() @IsString()  bannerGradient?:        string;
  @IsOptional() @IsBoolean() showEarlyAdopterBadge?: boolean;
  @IsOptional() @IsString()  presenceStatus?:       string;
  @IsOptional() @IsString()  expoPushToken?:         string | null;
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
  @UseGuards(OptionalJwtGuard)
  search(@Query("q") q: string, @Request() req) {
    const requestingUserId = req.user?.id;
    return this.usersService.search(q || "", 20, requestingUserId);
  }

  @Get(":username")
  @UseGuards(OptionalJwtGuard)
  getProfile(@Param("username") username: string, @Request() req) {
    const requestingUserId = req.user?.id;
    return this.usersService.getProfile(username, requestingUserId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMe(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}
