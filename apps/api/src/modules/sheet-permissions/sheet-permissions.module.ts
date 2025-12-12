import { Module } from '@nestjs/common';
import { SheetPermissionsController } from './sheet-permissions.controller';
import { SheetPermissionsService } from './sheet-permissions.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SheetPermissionsController],
    providers: [SheetPermissionsService],
    exports: [SheetPermissionsService],
})
export class SheetPermissionsModule { }
