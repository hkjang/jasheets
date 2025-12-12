import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { MacroApprovalService } from './macro-approval.service';
import { MacroApprovalController } from './macro-approval.controller';

@Module({
    imports: [PrismaModule],
    controllers: [MacroApprovalController],
    providers: [MacroApprovalService],
    exports: [MacroApprovalService],
})
export class MacroApprovalModule { }
