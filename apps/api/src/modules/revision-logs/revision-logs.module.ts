import { forwardRef, Module } from '@nestjs/common';
import { RevisionLogsController } from './revision-logs.controller';
import { RevisionLogsService } from './revision-logs.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SheetsModule } from '../sheets/sheets.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SheetsModule)],
  controllers: [RevisionLogsController],
  providers: [RevisionLogsService],
  exports: [RevisionLogsService],
})
export class RevisionLogsModule {}
