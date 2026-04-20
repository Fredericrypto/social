import {
  Controller, Get, Patch, Body, Param, Query,
  UseGuards, Request,
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
  @IsOptional() @IsString()  presenceStatus?:        string;
  @IsOptional() @IsString()  expoPushToken?:         string | null;
}

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Rotas fixas (devem vir ANTES de :username) ────────────────────────────

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

  /**
   * GET /users/presence?ids=uuid1,uuid2,uuid3
   * Retorna status de presença de múltiplos usuários de uma vez.
   * Usado pelo MessagesScreen para popular o presenceMap inicial.
   */
  @Get("presence")
  @UseGuards(OptionalJwtGuard)
  async getPresenceBatch(@Query("ids") ids: string) {
    if (!ids?.trim()) return [];
    const idList = ids.split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
    return this.usersService.getPresenceBatch(idList);
  }

  // ── Rotas com parâmetro (:username) ────────────────────────────────────────

  /**
   * GET /users/:username/presence
   * Retorna o status de presença de um usuário específico.
   * Usado pelo ChatScreen ao abrir uma conversa.
   */
  @Get(":username/presence")
  @UseGuards(OptionalJwtGuard)
  async getUserPresence(@Param("username") username: string) {
    return this.usersService.getUserPresence(username);
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
