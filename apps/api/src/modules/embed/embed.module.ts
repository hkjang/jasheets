import { Module } from '@nestjs/common';
import { EmbedController, EmbedConfigController } from './embed.controller';
import { EmbedService } from './embed.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [EmbedController, EmbedConfigController],
    providers: [EmbedService],
    exports: [EmbedService],
})
export class EmbedModule { }
