import { Module } from '@nestjs/common';
import { ConditionalRulesController } from './conditional-rules.controller';
import { ConditionalRulesService } from './conditional-rules.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ConditionalRulesController],
    providers: [ConditionalRulesService],
    exports: [ConditionalRulesService],
})
export class ConditionalRulesModule { }
