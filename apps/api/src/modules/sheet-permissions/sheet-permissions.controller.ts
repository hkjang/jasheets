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
import { SheetPermissionsService } from './sheet-permissions.service';
import { CreateSheetPermissionDto, UpdateSheetPermissionDto } from './dto/sheet-permission.dto';

@Controller('sheets/:sheetId/permissions')
@UseGuards(JwtAuthGuard)
export class SheetPermissionsController {
    constructor(private readonly sheetPermissionsService: SheetPermissionsService) { }

    @Get()
    async getPermissions(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        return this.sheetPermissionsService.getSheetPermissions(req.user.id, sheetId);
    }

    @Post()
    async addPermission(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
        @Body() dto: CreateSheetPermissionDto,
    ) {
        return this.sheetPermissionsService.addSheetPermission(req.user.id, sheetId, dto);
    }

    @Put(':permissionId')
    async updatePermission(
        @Request() req: any,
        @Param('permissionId') permissionId: string,
        @Body() dto: UpdateSheetPermissionDto,
    ) {
        return this.sheetPermissionsService.updateSheetPermission(req.user.id, permissionId, dto);
    }

    @Delete(':permissionId')
    async removePermission(
        @Request() req: any,
        @Param('permissionId') permissionId: string,
    ) {
        return this.sheetPermissionsService.removeSheetPermission(req.user.id, permissionId);
    }

    @Get('level')
    async getPermissionLevel(
        @Request() req: any,
        @Param('sheetId') sheetId: string,
    ) {
        const level = await this.sheetPermissionsService.getSheetPermissionLevel(req.user.id, sheetId);
        return { level };
    }
}
