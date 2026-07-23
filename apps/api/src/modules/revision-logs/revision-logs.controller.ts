import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RevisionLogsService } from './revision-logs.service';
import { GetRevisionsDto } from './dto/revision-log.dto';
import { RollbackRevisionDto } from './dto/rollback-revision.dto';
import { SpreadsheetCommandService } from '../spreadsheet-command/spreadsheet-command.service';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('sheets/:sheetId/revisions')
@UseGuards(JwtAuthGuard)
export class RevisionLogsController {
  constructor(
    private readonly revisionLogsService: RevisionLogsService,
    private readonly commands: SpreadsheetCommandService,
  ) {}

  @Get()
  async getRevisionTimeline(
    @Request() req: AuthenticatedRequest,
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
    @Request() req: AuthenticatedRequest,
    @Param('sheetId') sheetId: string,
  ) {
    return this.revisionLogsService.getRevisionStats(req.user.id, sheetId);
  }

  @Get(':revisionId')
  async getRevision(
    @Request() req: AuthenticatedRequest,
    @Param('revisionId') revisionId: string,
  ) {
    return this.revisionLogsService.getRevision(req.user.id, revisionId);
  }

  @Post(':revisionId/rollback')
  async rollbackToRevision(
    @Request() req: AuthenticatedRequest,
    @Param('sheetId') sheetId: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: RollbackRevisionDto,
  ) {
    return this.commands.execute(
      { userId: req.user.id, actorType: 'USER' },
      {
        type: 'ROLLBACK_REVISION',
        revisionId,
        sheetId,
        expectedVersion: dto.expectedVersion,
        idempotencyKey: dto.idempotencyKey,
      },
    );
  }
}
