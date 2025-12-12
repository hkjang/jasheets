import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { UDFApprovalService } from './udf-approval.service';
import { UDFApprovalController } from './udf-approval.controller';

@Module({
    imports: [PrismaModule],
    controllers: [UDFApprovalController],
    providers: [UDFApprovalService],
    exports: [UDFApprovalService],
})
export class UDFApprovalModule { }
