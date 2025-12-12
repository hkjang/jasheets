import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrossSheetReferenceService } from './cross-sheet-reference.service';

class CreateReferenceDto {
    sourceCell: string;
    targetSheetName: string;
    targetCell: string;
    formula: string;
}

@Controller('sheets/:sheetId/references')
@UseGuards(JwtAuthGuard)
export class CrossSheetReferenceController {
    constructor(private readonly crossSheetReferenceService: CrossSheetReferenceService) { }

    @Get()
    async getSheetReferences(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.crossSheetReferenceService.getSheetReferences(req.user.id, sheetId);
    }

    @Get('dependency-graph')
    async getDependencyGraph(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.crossSheetReferenceService.getDependencyGraph(req.user.id, sheetId);
    }

    @Post()
    async createReference(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateReferenceDto,
    ) {
        return this.crossSheetReferenceService.createReference(
            req.user.id,
            sheetId,
            dto.sourceCell,
            dto.targetSheetName,
            dto.targetCell,
            dto.formula,
        );
    }

    @Delete(':referenceId')
    async deleteReference(
        @Request() req: any,
        @Param('referenceId') referenceId: string,
    ) {
        return this.crossSheetReferenceService.deleteReference(req.user.id, referenceId);
    }

    @Get(':referenceId/resolve')
    async resolveReference(
        @Request() req: any,
        @Param('referenceId') referenceId: string,
    ) {
        return this.crossSheetReferenceService.resolveReference(req.user.id, referenceId);
    }
}

