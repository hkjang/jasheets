import { Module } from '@nestjs/common';
import { MasterViewController } from './master-view.controller';
import { MasterViewService } from './master-view.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [MasterViewController],
    providers: [MasterViewService],
    exports: [MasterViewService],
})
export class MasterViewModule { }
