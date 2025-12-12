import { Module } from '@nestjs/common';
import { RevisionLogsController } from './revision-logs.controller';
import { RevisionLogsService } from './revision-logs.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [RevisionLogsController],
    providers: [RevisionLogsService],
    exports: [RevisionLogsService],
})
export class RevisionLogsModule { }
