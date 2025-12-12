import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterViewService, SourceSheetConfig } from './master-view.service';

class CreateMasterViewDto {
    name: string;
    description?: string;
    sourceSheets: SourceSheetConfig[];
}

class UpdateMasterViewDto {
    name?: string;
    description?: string;
    sourceSheets?: SourceSheetConfig[];
    syncEnabled?: boolean;
}

class SyncChangesDto {
    changes: Array<{
        sourceSheetId: string;
        sourceRow: number;
        col: number;
        value: any;
    }>;
}

@Controller('spreadsheets/:spreadsheetId/master-views')
@UseGuards(JwtAuthGuard)
export class MasterViewController {
    constructor(private readonly masterViewService: MasterViewService) { }

    @Get()
    async getMasterViews(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
    ) {
        return this.masterViewService.getMasterViews(req.user.id, spreadsheetId);
    }

    @Get(':viewId')
    async getMasterView(
        @Request() req: any,
        @Param('viewId') viewId: string,
    ) {
        return this.masterViewService.getMasterView(req.user.id, viewId);
    }

    @Get(':viewId/data')
    async getMergedData(
        @Request() req: any,
        @Param('viewId') viewId: string,
    ) {
        return this.masterViewService.getMergedData(req.user.id, viewId);
    }

    @Post()
    async createMasterView(
        @Request() req: any,
        @Param('spreadsheetId') spreadsheetId: string,
        @Body() dto: CreateMasterViewDto,
    ) {
        return this.masterViewService.createMasterView(req.user.id, spreadsheetId, dto);
    }

    @Put(':viewId')
    async updateMasterView(
        @Request() req: any,
        @Param('viewId') viewId: string,
        @Body() dto: UpdateMasterViewDto,
    ) {
        return this.masterViewService.updateMasterView(req.user.id, viewId, dto);
    }

    @Delete(':viewId')
    async deleteMasterView(
        @Request() req: any,
        @Param('viewId') viewId: string,
    ) {
        return this.masterViewService.deleteMasterView(req.user.id, viewId);
    }

    @Post(':viewId/sync')
    async syncToSource(
        @Request() req: any,
        @Param('viewId') viewId: string,
        @Body() dto: SyncChangesDto,
    ) {
        return this.masterViewService.syncToSource(req.user.id, viewId, dto.changes);
    }
}
