import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { AIConfigService } from './ai-config.service';
import { AIConfigController } from './ai-config.controller';

@Module({
    imports: [PrismaModule],
    controllers: [AIConfigController],
    providers: [AIConfigService],
    exports: [AIConfigService],
})
export class AIConfigModule { }
