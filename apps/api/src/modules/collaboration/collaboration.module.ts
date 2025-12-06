import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [SheetsModule],
  providers: [CollaborationGateway],
  exports: [CollaborationGateway],
})
export class CollaborationModule {}
