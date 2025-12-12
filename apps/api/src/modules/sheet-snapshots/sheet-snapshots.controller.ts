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
import { SheetSnapshotsService } from './sheet-snapshots.service';

class CreateSnapshotDto {
    name: string;
    description?: string;
    parentId?: string;
}

@Controller('sheets/:sheetId/snapshots')
@UseGuards(JwtAuthGuard)
export class SheetSnapshotsController {
    constructor(private readonly sheetSnapshotsService: SheetSnapshotsService) { }

    @Get()
    async getSnapshots(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.sheetSnapshotsService.getSnapshots(req.user.id, sheetId);
    }

    @Get(':snapshotId')
    async getSnapshot(
        @Request() req: any,
        @Param('snapshotId') snapshotId: string,
    ) {
        return this.sheetSnapshotsService.getSnapshot(req.user.id, snapshotId);
    }

    @Post()
    async createSnapshot(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateSnapshotDto,
    ) {
        return this.sheetSnapshotsService.createSnapshot(
            req.user.id,
            sheetId,
            dto.name,
            dto.description,
            dto.parentId,
        );
    }

    @Post(':snapshotId/restore')
    async restoreSnapshot(
        @Request() req: any,
        @Param('snapshotId') snapshotId: string,
    ) {
        return this.sheetSnapshotsService.restoreSnapshot(req.user.id, snapshotId);
    }

    @Get(':snapshotId/compare/:otherSnapshotId')
    async compareSnapshots(
        @Request() req: any,
        @Param('snapshotId') snapshotId: string,
        @Param('otherSnapshotId') otherSnapshotId: string,
    ) {
        return this.sheetSnapshotsService.compareSnapshots(req.user.id, snapshotId, otherSnapshotId);
    }

    @Post(':snapshotId/branch')
    async createBranch(
        @Request() req: any,
        @Param('snapshotId') snapshotId: string,
        @Body() dto: { branchName: string; description?: string },
    ) {
        return this.sheetSnapshotsService.createBranch(
            req.user.id,
            snapshotId,
            dto.branchName,
            dto.description,
        );
    }

    @Delete(':snapshotId')
    async deleteSnapshot(
        @Request() req: any,
        @Param('snapshotId') snapshotId: string,
    ) {
        return this.sheetSnapshotsService.deleteSnapshot(req.user.id, snapshotId);
    }
}
