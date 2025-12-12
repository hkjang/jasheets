import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MacroApprovalService } from './macro-approval.service';
import type { CreateMacroApprovalDto, ReviewMacroDto } from './macro-approval.service';


@Controller('admin/macro-approvals')
@UseGuards(JwtAuthGuard)
export class MacroApprovalController {
    constructor(private readonly macroApprovalService: MacroApprovalService) { }

    @Post('request')
    async requestApproval(@Request() req: any, @Body() dto: CreateMacroApprovalDto) {
        return this.macroApprovalService.requestApproval(req.user.id, dto);
    }

    @Put(':id/review')
    async review(@Param('id') id: string, @Request() req: any, @Body() dto: ReviewMacroDto) {
        return this.macroApprovalService.review(id, req.user.id, dto);
    }

    @Put(':id/revoke')
    async revoke(@Param('id') id: string, @Request() req: any, @Body() body: { reason?: string }) {
        return this.macroApprovalService.revoke(id, req.user.id, body.reason);
    }

    @Get()
    async findAll(@Query('status') status?: string) {
        return this.macroApprovalService.findAll(status as any);
    }


    @Get('pending')
    async findPending() {
        return this.macroApprovalService.findPending();
    }

    @Get('stats')
    async getStats() {
        return this.macroApprovalService.getStats();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.macroApprovalService.findOne(id);
    }

    @Post('lint')
    async lintCode(@Body() body: { code: string }) {
        return this.macroApprovalService.lintCode(body.code);
    }
}

