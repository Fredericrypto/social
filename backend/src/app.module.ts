import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PostsModule } from "./posts/posts.module";
import { FeedModule } from "./feed/feed.module";
import { FollowsModule } from "./follows/follows.module";
import { LikesModule } from "./likes/likes.module";
import { CommentsModule } from "./comments/comments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MediaModule } from "./media/media.module";
import { MessagesModule } from "./messages/messages.module";
import { BlocksModule } from "./blocks/blocks.module";
import { ReportsModule } from "./reports/reports.module";
import { InvitesModule } from "./invites/invites.module";
import { StoriesModule } from "./stories/stories.module";
import { SavedModule } from "./saved/saved.module";
import { HealthModule } from "./health/health.module";
import { User } from "./users/entities/user.entity";
import { Post } from "./posts/entities/post.entity";
import { Follow } from "./follows/entities/follow.entity";
import { Like } from "./likes/entities/like.entity";
import { Comment } from "./comments/entities/comment.entity";
import { Notification } from "./notifications/entities/notification.entity";
import { FeedItem } from "./feed/entities/feed.entity";
import { Invite } from "./invites/entities/invite.entity";
import { Block } from "./blocks/entities/block.entity";
import { Conversation } from "./messages/entities/conversation.entity";
import { Message } from "./messages/entities/message.entity";
import { Report } from "./reports/entities/report.entity";
import { Story } from "./stories/entities/story.entity";
import { StoryView } from "./stories/entities/story-view.entity";
import { SavedPost } from "./saved/saved.entity";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

const ENTITIES = [User, Post, Follow, Like, Comment, Notification, Story, StoryView, FeedItem, Invite, Block, Conversation, Message, Report, SavedPost];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    TypeOrmModule.forRootAsync({
      imports: [
    ConfigModule],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const isProd = config.get<string>("NODE_ENV") === "production";
        const dbUrl = config.get<string>("DATABASE_URL");
        if (dbUrl) {
          return {
            type: "postgres",
            url: dbUrl,
            entities: ENTITIES,
            synchronize: config.get<string>("SYNC_DB") === "true",
            ssl: { rejectUnauthorized: false },
            logging: false,
          };
        }
        return {
          type: "postgres",
          host: config.get<string>("DB_HOST") || "localhost",
          port: config.get<number>("DB_PORT") || 5432,
          username: config.get<string>("DB_USERNAME") || "postgres",
          password: config.get<string>("DB_PASSWORD") || "postgres",
          database: config.get<string>("DB_NAME") || "minha_rede",
          entities: ENTITIES,
          synchronize: isProd === false,
          ssl: false,
          logging: false,
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule, UsersModule, PostsModule, FeedModule,
    FollowsModule, LikesModule, CommentsModule,
    NotificationsModule, MediaModule, MessagesModule,
    BlocksModule, ReportsModule, InvitesModule, HealthModule, StoriesModule, SavedModule,
  ],
})
export class AppModule {}
