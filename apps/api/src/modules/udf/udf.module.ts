import { Module } from '@nestjs/common';
import { UDFService } from './udf.service';
import { UDFController } from './udf.controller';
import { PrismaModule } from '../../prisma';

@Module({
    imports: [PrismaModule],
    controllers: [UDFController],
    providers: [UDFService],
    exports: [UDFService],
})
export class UDFModule { }
