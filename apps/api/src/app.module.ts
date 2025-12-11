import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { AuthModule } from './modules/auth/auth.module';
import { SheetsModule } from './modules/sheets/sheets.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { VersioningModule } from './modules/versioning/versioning.module';
import { AIModule } from './modules/ai/ai.module';
import { CommentsModule } from './modules/comments/comments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RolesModule } from './modules/roles/roles.module';
import { NoticesModule } from './modules/notices/notices.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { EventsModule } from './modules/events/events.module';
import { FlowsModule } from './modules/flows/flows.module';
import { EmbedModule } from './modules/embed/embed.module';
import { NormalizerModule } from './modules/normalizer/normalizer.module';
import { ProfilerModule } from './modules/profiler/profiler.module';
import { UDFModule } from './modules/udf/udf.module';
import { DocumentationModule } from './modules/documentation/documentation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    OAuthModule,
    SheetsModule,
    CollaborationModule,
    VersioningModule,
    AIModule,
    CommentsModule,
    WebhooksModule,
    NotificationsModule,
    UsersModule,
    AuditModule,
    SettingsModule,
    RolesModule,
    NoticesModule,
    TemplatesModule,
    EventsModule,
    FlowsModule,
    EmbedModule,
    NormalizerModule,
    ProfilerModule,
    UDFModule,
    DocumentationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }



