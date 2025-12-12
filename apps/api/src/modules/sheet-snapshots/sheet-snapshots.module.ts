import { Module } from '@nestjs/common';
import { SheetSnapshotsController } from './sheet-snapshots.controller';
import { SheetSnapshotsService } from './sheet-snapshots.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SheetSnapshotsController],
    providers: [SheetSnapshotsService],
    exports: [SheetSnapshotsService],
})
export class SheetSnapshotsModule { }
