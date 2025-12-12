import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { SheetLockService } from './sheet-lock.service';
import { SheetLockController } from './sheet-lock.controller';

@Module({
    imports: [PrismaModule],
    controllers: [SheetLockController],
    providers: [SheetLockService],
    exports: [SheetLockService],
})
export class SheetLockModule { }
