import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { DocumentationService } from './documentation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface GenerateDocDto {
    data: any[][];
    options?: {
        sheetName?: string;
        headers?: string[];
        includeFormulas?: boolean;
        includeRelationships?: boolean;
    };
}

interface GenerateDictionaryDto {
    sheets: { name: string; data: any[][]; headers?: string[] }[];
    title?: string;
}

@Controller('documentation')
@UseGuards(JwtAuthGuard)
export class DocumentationController {
    constructor(private readonly documentationService: DocumentationService) { }

    @Post('sheet')
    async generateSheetDoc(@Body() dto: GenerateDocDto) {
        return this.documentationService.generateSheetDocumentation(dto.data, dto.options || {});
    }

    @Post('sheet/markdown')
    async generateSheetMarkdown(@Body() dto: GenerateDocDto) {
        const doc = await this.documentationService.generateSheetDocumentation(dto.data, dto.options || {});
        return {
            documentation: doc,
            markdown: this.documentationService.generateMarkdown(doc),
        };
    }

    @Post('dictionary')
    async generateDataDictionary(@Body() dto: GenerateDictionaryDto) {
        return this.documentationService.generateDataDictionary(dto.sheets, dto.title);
    }
}

