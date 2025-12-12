import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RevisionLogsService } from './revision-logs.service';
import { GetRevisionsDto } from './dto/revision-log.dto';

@Controller('sheets/:sheetId/revisions')
@UseGuards(JwtAuthGuard)
export class RevisionLogsController {
    constructor(private readonly revisionLogsService: RevisionLogsService) { }

    @Get()
    async getRevisionTimeline(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Query() dto: GetRevisionsDto,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.revisionLogsService.getRevisionTimeline(
            req.user.id,
            sheetId,
            dto,
            limit ? parseInt(limit, 10) : 100,
            offset ? parseInt(offset, 10) : 0,
        );
    }

    @Get('stats')
    async getRevisionStats(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.revisionLogsService.getRevisionStats(req.user.id, sheetId);
    }

    @Get(':revisionId')
    async getRevision(
        @Request() req: any,
        @Param('revisionId') revisionId: string,
    ) {
        return this.revisionLogsService.getRevision(req.user.id, revisionId);
    }

    @Post(':revisionId/rollback')
    async rollbackToRevision(
        @Request() req: any,
        @Param('revisionId') revisionId: string,
    ) {
        return this.revisionLogsService.rollbackToRevision(req.user.id, revisionId);
    }
}
