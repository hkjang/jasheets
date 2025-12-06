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
import { SheetsService } from './sheets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSpreadsheetDto } from './dto/create-spreadsheet.dto';
import { UpdateSpreadsheetDto } from './dto/update-spreadsheet.dto';
import { UpdateCellDto, UpdateCellsDto } from './dto/update-cell.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('sheets')
@UseGuards(JwtAuthGuard)
export class SheetsController {
  constructor(private readonly sheetsService: SheetsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateSpreadsheetDto) {
    return this.sheetsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.sheetsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.sheetsService.findOne(req.user.id, id);
  }

  @Put(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSpreadsheetDto,
  ) {
    return this.sheetsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.sheetsService.remove(req.user.id, id);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAllAdmin() {
    return this.sheetsService.findAllAdmin();
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  removeAdmin(@Param('id') id: string) {
    return this.sheetsService.removeAdmin(id);
  }

  @Get('trash')
  @UseGuards(JwtAuthGuard, AdminGuard)
  listTrash(@Request() req: any) {
    return this.sheetsService.listTrash(req.user.id);
  }

  @Post('trash/:id/restore')
  @UseGuards(JwtAuthGuard, AdminGuard)
  restore(@Request() req: any, @Param('id') id: string) {
    return this.sheetsService.restore(req.user.id, id);
  }

  @Delete('trash/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  hardDelete(@Request() req: any, @Param('id') id: string) {
    return this.sheetsService.hardDelete(req.user.id, id);
  }

  // Sheet operations
  @Post(':id/sheets')
  addSheet(
    @Request() req: any,
    @Param('id') spreadsheetId: string,
    @Body() dto: { name: string },
  ) {
    return this.sheetsService.addSheet(req.user.id, spreadsheetId, dto.name);
  }

  @Put('sheet/:sheetId')
  updateSheet(
    @Request() req: any,
    @Param('sheetId') sheetId: string,
    @Body() dto: { name?: string },
  ) {
    return this.sheetsService.updateSheet(req.user.id, sheetId, dto);
  }

  @Delete('sheet/:sheetId')
  deleteSheet(@Request() req: any, @Param('sheetId') sheetId: string) {
    return this.sheetsService.deleteSheet(req.user.id, sheetId);
  }

  // Cell operations
  @Put('sheet/:sheetId/cell/:row/:col')
  updateCell(
    @Request() req: any,
    @Param('sheetId') sheetId: string,
    @Param('row') row: string,
    @Param('col') col: string,
    @Body() dto: UpdateCellDto,
  ) {
    return this.sheetsService.updateCell(
      req.user.id,
      sheetId,
      parseInt(row, 10),
      parseInt(col, 10),
      dto,
    );
  }

  @Put('sheet/:sheetId/cells')
  updateCells(
    @Request() req: any,
    @Param('sheetId') sheetId: string,
    @Body() dto: UpdateCellsDto,
  ) {
    return this.sheetsService.updateCells(req.user.id, sheetId, dto.updates);
  }
}
