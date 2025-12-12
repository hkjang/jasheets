import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SheetLockService } from './sheet-lock.service';
import type { CreateSheetLockDto } from './sheet-lock.service';


@Controller('admin/sheet-locks')
@UseGuards(JwtAuthGuard)
export class SheetLockController {
    constructor(private readonly sheetLockService: SheetLockService) { }

    @Post()
    async lockSheet(@Request() req: any, @Body() dto: CreateSheetLockDto) {
        return this.sheetLockService.lockSheet(req.user.id, dto);
    }

    @Delete(':sheetId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async unlockSheet(@Request() req: any, @Param('sheetId') sheetId: string) {
        await this.sheetLockService.unlockSheet(req.user.id, sheetId, req.user.isAdmin);
    }

    @Delete(':sheetId/force')
    @HttpCode(HttpStatus.NO_CONTENT)
    async forceUnlock(@Param('sheetId') sheetId: string) {
        await this.sheetLockService.forceUnlock(sheetId);
    }

    @Get()
    async getAllLocks() {
        return this.sheetLockService.getLocksWithDetails();
    }

    @Get(':sheetId/status')
    async getLockStatus(@Request() req: any, @Param('sheetId') sheetId: string) {
        return this.sheetLockService.getLockStatus(sheetId, req.user?.id);
    }

    @Post('cleanup')
    async cleanupExpiredLocks() {
        const count = await this.sheetLockService.cleanupExpiredLocks();
        return { cleaned: count };
    }
}

