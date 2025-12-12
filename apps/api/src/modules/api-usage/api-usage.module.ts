import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { APIUsageService } from './api-usage.service';
import { APIUsageController } from './api-usage.controller';

@Module({
    imports: [PrismaModule],
    controllers: [APIUsageController],
    providers: [APIUsageService],
    exports: [APIUsageService],
})
export class APIUsageModule { }
