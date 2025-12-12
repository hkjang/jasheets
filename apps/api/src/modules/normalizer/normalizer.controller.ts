import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { NormalizerService } from './normalizer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface NormalizeRangeDto {
    data: any[][];
    options?: {
        normalizeDate?: boolean;
        normalizeCurrency?: boolean;
        normalizeNumbers?: boolean;
        normalizeText?: boolean;
        targetDateFormat?: string;
        targetCurrency?: string;
    };
}

interface DetectTypeDto {
    value: any;
}

interface AnalyzeColumnsDto {
    data: any[][];
}

@Controller('normalizer')
@UseGuards(JwtAuthGuard)
export class NormalizerController {
    constructor(private readonly normalizerService: NormalizerService) { }

    @Post('normalize')
    normalizeRange(@Body() dto: NormalizeRangeDto) {
        const result = this.normalizerService.normalizeRange(dto.data, dto.options || {});
        return {
            ...result,
            normalizedData: dto.data, // data is mutated in place
        };
    }

    @Post('detect-type')
    detectType(@Body() dto: DetectTypeDto) {
        return this.normalizerService.detectType(dto.value);
    }

    @Post('analyze-columns')
    analyzeColumns(@Body() dto: AnalyzeColumnsDto) {
        return this.normalizerService.analyzeColumnTypes(dto.data);
    }
}

