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
import { PromptTemplateService } from './prompt-template.service';
import type { CreatePromptTemplateDto, UpdatePromptTemplateDto } from './prompt-template.service';


@Controller('admin/prompt-templates')
@UseGuards(JwtAuthGuard)
export class PromptTemplateController {
    constructor(private readonly promptTemplateService: PromptTemplateService) { }

    @Post()
    async create(@Body() dto: CreatePromptTemplateDto) {
        return this.promptTemplateService.create(dto);
    }

    @Get()
    async findAll(@Query('category') category?: string) {
        if (category) {
            return this.promptTemplateService.findByCategory(category as any);
        }
        return this.promptTemplateService.findAll();
    }

    @Get('default/:category')
    async findDefault(@Param('category') category: string) {
        return this.promptTemplateService.findDefault(category as any);
    }


    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.promptTemplateService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdatePromptTemplateDto) {
        return this.promptTemplateService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string) {
        await this.promptTemplateService.delete(id);
    }

    @Post(':id/render')
    async renderTemplate(@Param('id') id: string, @Body() body: { variables: Record<string, string> }) {
        const template = await this.promptTemplateService.findOne(id);
        return { rendered: this.promptTemplateService.renderTemplate(template, body.variables) };
    }
}

