import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface GenerateFormulaDto {
  prompt: string;
  context: {
    selectedRange?: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    };
    nearbyData?: any[][];
    columnHeaders?: string[];
    sheetName: string;
  };
}

interface ExplainFormulaDto {
  formula: string;
}

interface SuggestFixDto {
  formula: string;
  errorType: string;
}

interface AutoFillDto {
  existingData: any[][];
  direction: 'down' | 'right';
  count: number;
}

interface ChartRecommendDto {
  data: any[][];
}

interface SummarizeDataDto {
  data: any[][];
  headers?: string[];
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('formula/generate')
  generateFormula(@Body() dto: GenerateFormulaDto) {
    return this.aiService.generateFormula(dto.prompt, dto.context);
  }

  @Post('formula/explain')
  explainFormula(@Body() dto: ExplainFormulaDto) {
    return this.aiService.explainFormula(dto.formula);
  }

  @Post('formula/suggest-fix')
  suggestFix(@Body() dto: SuggestFixDto) {
    return this.aiService.suggestErrorFix(dto.formula, dto.errorType);
  }

  @Post('autofill')
  autoFill(@Body() dto: AutoFillDto) {
    return this.aiService.suggestAutoFill(dto.existingData, dto.direction, dto.count);
  }

  @Post('chart/recommend')
  recommendChart(@Body() dto: ChartRecommendDto) {
    return this.aiService.recommendChart(dto.data);
  }

  @Post('data/summarize')
  summarizeData(@Body() dto: SummarizeDataDto) {
    return this.aiService.summarizeData(dto.data, dto.headers);
  }
}
