import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotaService } from './quota.service';
import type { CreateQuotaDto, UpdateQuotaDto } from './quota.service';


@Controller('admin/quotas')
@UseGuards(JwtAuthGuard)
export class QuotaController {
    constructor(private readonly quotaService: QuotaService) { }

    @Post()
    async create(@Body() dto: CreateQuotaDto) {
        return this.quotaService.create(dto);
    }

    @Get()
    async findAll(@Query('type') type?: string) {
        if (type) {
            return this.quotaService.findByType(type as any);
        }
        return this.quotaService.findAll();
    }

    @Get('defaults')
    async getDefaultLimits() {
        return this.quotaService.getDefaultLimits();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.quotaService.findOne(id);
    }

    @Get('check/:targetType/:targetId')
    async checkQuota(@Param('targetType') targetType: string, @Param('targetId') targetId: string) {
        return this.quotaService.checkQuota(targetType as any, targetId);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateQuotaDto) {
        return this.quotaService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string) {
        await this.quotaService.delete(id);
    }
}

