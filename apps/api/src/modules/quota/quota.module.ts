import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { QuotaService } from './quota.service';
import { QuotaController } from './quota.controller';

@Module({
    imports: [PrismaModule],
    controllers: [QuotaController],
    providers: [QuotaService],
    exports: [QuotaService],
})
export class QuotaModule { }
