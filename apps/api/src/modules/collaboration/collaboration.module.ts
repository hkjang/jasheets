import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { SheetsModule } from '../sheets/sheets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SheetsModule, AuthModule],
  providers: [CollaborationGateway],
  exports: [CollaborationGateway],
})
export class CollaborationModule {}
