import { Module } from '@nestjs/common';
import { CrossSheetReferenceController } from './cross-sheet-reference.controller';
import { CrossSheetReferenceService } from './cross-sheet-reference.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CrossSheetReferenceController],
    providers: [CrossSheetReferenceService],
    exports: [CrossSheetReferenceService],
})
export class CrossSheetReferenceModule { }
