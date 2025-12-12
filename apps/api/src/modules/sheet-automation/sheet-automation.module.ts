import { Module } from '@nestjs/common';
import { SheetAutomationController } from './sheet-automation.controller';
import { SheetAutomationService } from './sheet-automation.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SheetAutomationController],
    providers: [SheetAutomationService],
    exports: [SheetAutomationService],
})
export class SheetAutomationModule { }
