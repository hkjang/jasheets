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
import { UDFApprovalService } from './udf-approval.service';
import type { CreateUDFApprovalDto, ReviewUDFDto } from './udf-approval.service';


@Controller('admin/udf-approvals')
@UseGuards(JwtAuthGuard)
export class UDFApprovalController {
    constructor(private readonly udfApprovalService: UDFApprovalService) { }

    @Post('request')
    async requestApproval(@Request() req: any, @Body() dto: CreateUDFApprovalDto) {
        return this.udfApprovalService.requestApproval(req.user.id, dto);
    }

    @Put(':id/review')
    async review(@Param('id') id: string, @Request() req: any, @Body() dto: ReviewUDFDto) {
        return this.udfApprovalService.review(id, req.user.id, dto);
    }

    @Put(':id/revoke')
    async revoke(@Param('id') id: string, @Request() req: any, @Body() body: { reason?: string }) {
        return this.udfApprovalService.revoke(id, req.user.id, body.reason);
    }

    @Get()
    async findAll(@Query('status') status?: string) {
        return this.udfApprovalService.findAll(status as any);
    }


    @Get('pending')
    async findPending() {
        return this.udfApprovalService.findPending();
    }

    @Get('stats')
    async getStats() {
        return this.udfApprovalService.getStats();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.udfApprovalService.findOne(id);
    }

    @Get('spreadsheet/:spreadsheetId')
    async findBySpreadsheet(@Param('spreadsheetId') spreadsheetId: string) {
        return this.udfApprovalService.findBySpreadsheet(spreadsheetId);
    }

    @Post('analyze')
    async analyzeCode(@Body() body: { code: string }) {
        return this.udfApprovalService.analyzeCodeRisk(body.code);
    }
}

