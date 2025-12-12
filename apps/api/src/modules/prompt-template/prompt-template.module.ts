import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { PromptTemplateService } from './prompt-template.service';
import { PromptTemplateController } from './prompt-template.controller';

@Module({
    imports: [PrismaModule],
    controllers: [PromptTemplateController],
    providers: [PromptTemplateService],
    exports: [PromptTemplateService],
})
export class PromptTemplateModule { }
