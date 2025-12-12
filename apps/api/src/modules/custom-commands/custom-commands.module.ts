import { Module } from '@nestjs/common';
import { CustomCommandsController } from './custom-commands.controller';
import { CustomCommandsService } from './custom-commands.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CustomCommandsController],
    providers: [CustomCommandsService],
    exports: [CustomCommandsService],
})
export class CustomCommandsModule { }
