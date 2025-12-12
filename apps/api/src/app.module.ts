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
// Phase 1: Advanced Sheet Features
import { SheetPermissionsModule } from './modules/sheet-permissions/sheet-permissions.module';
import { RevisionLogsModule } from './modules/revision-logs/revision-logs.module';
import { ConditionalRulesModule } from './modules/conditional-rules/conditional-rules.module';
import { CrossSheetReferenceModule } from './modules/cross-sheet-reference/cross-sheet-reference.module';
// Phase 2-3: Advanced Features
import { SheetAutomationModule } from './modules/sheet-automation/sheet-automation.module';
import { FilterProfilesModule } from './modules/filter-profiles/filter-profiles.module';
import { SheetSnapshotsModule } from './modules/sheet-snapshots/sheet-snapshots.module';
import { CustomCommandsModule } from './modules/custom-commands/custom-commands.module';
import { MasterViewModule } from './modules/master-view/master-view.module';
// Admin Features - Sheet Advanced Management
import { PermissionPolicyModule } from './modules/permission-policy/permission-policy.module';
import { SheetLockModule } from './modules/sheet-lock/sheet-lock.module';
import { UDFApprovalModule } from './modules/udf-approval/udf-approval.module';
import { AIConfigModule } from './modules/ai-config/ai-config.module';
import { PromptTemplateModule } from './modules/prompt-template/prompt-template.module';
import { QuotaModule } from './modules/quota/quota.module';
import { MacroApprovalModule } from './modules/macro-approval/macro-approval.module';
import { ActivityTrackerModule } from './modules/activity-tracker/activity-tracker.module';
import { APIUsageModule } from './modules/api-usage/api-usage.module';

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
    // Phase 1: Advanced Sheet Features
    SheetPermissionsModule,
    RevisionLogsModule,
    ConditionalRulesModule,
    CrossSheetReferenceModule,
    // Phase 2-3: Advanced Features
    SheetAutomationModule,
    FilterProfilesModule,
    SheetSnapshotsModule,
    CustomCommandsModule,
    MasterViewModule,
    // Admin Features - Sheet Advanced Management
    PermissionPolicyModule,
    SheetLockModule,
    UDFApprovalModule,
    AIConfigModule,
    PromptTemplateModule,
    QuotaModule,
    MacroApprovalModule,
    ActivityTrackerModule,
    APIUsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
