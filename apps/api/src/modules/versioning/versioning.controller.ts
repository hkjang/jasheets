import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VersioningService } from './versioning.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('versions')
@UseGuards(JwtAuthGuard)
export class VersioningController {
  constructor(private readonly versioningService: VersioningService) {}

  // Create a new version
  @Post('spreadsheet/:spreadsheetId')
  createVersion(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() dto: { name?: string },
  ) {
    return this.versioningService.createVersion(req.user.id, spreadsheetId, dto.name);
  }

  // Get version history
  @Get('spreadsheet/:spreadsheetId')
  getVersions(
    @Request() req: any,
    @Param('spreadsheetId') spreadsheetId: string,
    @Query('limit') limit?: string,
  ) {
    return this.versioningService.getVersions(
      req.user.id,
      spreadsheetId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // Get a specific version
  @Get(':versionId')
  getVersion(@Request() req: any, @Param('versionId') versionId: string) {
    return this.versioningService.getVersion(req.user.id, versionId);
  }

  // Restore a version
  @Post(':versionId/restore')
  restoreVersion(@Request() req: any, @Param('versionId') versionId: string) {
    return this.versioningService.restoreVersion(req.user.id, versionId);
  }

  // Name a version
  @Put(':versionId/name')
  nameVersion(
    @Request() req: any,
    @Param('versionId') versionId: string,
    @Body() dto: { name: string },
  ) {
    return this.versioningService.nameVersion(req.user.id, versionId, dto.name);
  }

  // Compare two versions
  @Get('compare/:versionId1/:versionId2')
  compareVersions(
    @Request() req: any,
    @Param('versionId1') versionId1: string,
    @Param('versionId2') versionId2: string,
  ) {
    return this.versioningService.compareVersions(req.user.id, versionId1, versionId2);
  }
}
