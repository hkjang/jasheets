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
import { AIConfigService } from './ai-config.service';
import type { CreateAIConfigDto, UpdateAIConfigDto } from './ai-config.service';


@Controller('admin/ai-configs')
@UseGuards(JwtAuthGuard)
export class AIConfigController {
    constructor(private readonly aiConfigService: AIConfigService) { }

    @Post()
    async create(@Body() dto: CreateAIConfigDto) {
        return this.aiConfigService.create(dto);
    }

    @Get()
    async findAll(@Query('type') type?: string) {
        if (type) {
            return this.aiConfigService.findByType(type as any);
        }
        return this.aiConfigService.findAll();
    }

    @Get('default/:type')
    async findDefault(@Param('type') type: string) {
        return this.aiConfigService.findDefault(type as any);
    }

    @Get('active/:type')
    async getActiveConfig(@Param('type') type: string) {
        return this.aiConfigService.getActiveConfig(type as any);
    }


    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.aiConfigService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateAIConfigDto) {
        return this.aiConfigService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string) {
        await this.aiConfigService.delete(id);
    }
}

