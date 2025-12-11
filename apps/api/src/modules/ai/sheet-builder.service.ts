import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// DSL Types for Sheet Structure
export interface ColumnDef {
    name: string;
    type: 'text' | 'number' | 'date' | 'currency' | 'percent' | 'formula';
    width?: number;
    format?: string;
    formula?: string;
    validation?: ValidationRule;
}

export interface ValidationRule {
    type: 'list' | 'number' | 'date' | 'text';
    values?: string[];
    min?: number;
    max?: number;
    pattern?: string;
}

export interface FormulaRule {
    column: number;
    formula: string;
    applyToAllRows: boolean;
}

export interface ConditionalFormat {
    range: string;
    condition: {
        type: 'greater' | 'less' | 'equal' | 'between' | 'text_contains' | 'duplicate';
        value?: number | string;
        value2?: number | string;
    };
    style: {
        backgroundColor?: string;
        textColor?: string;
        bold?: boolean;
        italic?: boolean;
    };
}

export interface SheetDSL {
    name: string;
    description?: string;
    columns: ColumnDef[];
    formulas: FormulaRule[];
    conditionalFormats: ConditionalFormat[];
    sampleData?: any[][];
    frozenRows?: number;
    frozenCols?: number;
}

export interface SheetBuildResult {
    dsl: SheetDSL;
    cells: CellData[][];
    explanation: string;
    confidence: number;
}

interface CellData {
    value?: any;
    formula?: string;
    format?: {
        backgroundColor?: string;
        textColor?: string;
        bold?: boolean;
        numberFormat?: string;
    };
}

// Template definitions for common sheet types
const SHEET_TEMPLATES: Record<string, SheetDSL> = {
    customer_management: {
        name: '고객 관리',
        description: '고객 정보를 관리하는 시트입니다.',
        columns: [
            { name: '고객ID', type: 'text', width: 80 },
            { name: '고객명', type: 'text', width: 120 },
            { name: '연락처', type: 'text', width: 120 },
            { name: '이메일', type: 'text', width: 180 },
            { name: '가입일', type: 'date', width: 100 },
            { name: '등급', type: 'text', width: 80, validation: { type: 'list', values: ['VIP', '골드', '실버', '일반'] } },
            { name: '총 구매액', type: 'currency', width: 120 },
            { name: '최근 구매일', type: 'date', width: 100 },
        ],
        formulas: [],
        conditionalFormats: [
            {
                range: 'F2:F100',
                condition: { type: 'equal', value: 'VIP' },
                style: { backgroundColor: '#FFD700', bold: true },
            },
        ],
        frozenRows: 1,
    },
    sales_report: {
        name: '매출 보고서',
        description: '월별/제품별 매출을 관리하는 시트입니다.',
        columns: [
            { name: '날짜', type: 'date', width: 100 },
            { name: '제품명', type: 'text', width: 150 },
            { name: '수량', type: 'number', width: 80 },
            { name: '단가', type: 'currency', width: 100 },
            { name: '매출액', type: 'formula', width: 120, formula: '=C{row}*D{row}' },
            { name: '원가', type: 'currency', width: 100 },
            { name: '이익', type: 'formula', width: 120, formula: '=E{row}-F{row}' },
            { name: '이익률', type: 'formula', width: 80, formula: '=G{row}/E{row}*100' },
        ],
        formulas: [
            { column: 4, formula: '=C{row}*D{row}', applyToAllRows: true },
            { column: 6, formula: '=E{row}-F{row}', applyToAllRows: true },
            { column: 7, formula: '=G{row}/E{row}*100', applyToAllRows: true },
        ],
        conditionalFormats: [
            {
                range: 'H2:H100',
                condition: { type: 'greater', value: 30 },
                style: { backgroundColor: '#90EE90' },
            },
            {
                range: 'H2:H100',
                condition: { type: 'less', value: 10 },
                style: { backgroundColor: '#FFB6C1' },
            },
        ],
        frozenRows: 1,
    },
    inventory_tracker: {
        name: '재고 관리',
        description: '재고 현황을 추적하는 시트입니다.',
        columns: [
            { name: '제품코드', type: 'text', width: 100 },
            { name: '제품명', type: 'text', width: 150 },
            { name: '카테고리', type: 'text', width: 100 },
            { name: '현재고', type: 'number', width: 80 },
            { name: '안전재고', type: 'number', width: 80 },
            { name: '상태', type: 'formula', width: 80, formula: '=IF(D{row}<E{row},"부족","정상")' },
            { name: '입고예정', type: 'number', width: 80 },
            { name: '단가', type: 'currency', width: 100 },
            { name: '재고금액', type: 'formula', width: 120, formula: '=D{row}*H{row}' },
        ],
        formulas: [
            { column: 5, formula: '=IF(D{row}<E{row},"부족","정상")', applyToAllRows: true },
            { column: 8, formula: '=D{row}*H{row}', applyToAllRows: true },
        ],
        conditionalFormats: [
            {
                range: 'F2:F100',
                condition: { type: 'equal', value: '부족' },
                style: { backgroundColor: '#FF6B6B', textColor: '#FFFFFF', bold: true },
            },
        ],
        frozenRows: 1,
    },
    expense_tracker: {
        name: '경비 지출',
        description: '경비 지출을 추적하는 시트입니다.',
        columns: [
            { name: '날짜', type: 'date', width: 100 },
            { name: '카테고리', type: 'text', width: 100, validation: { type: 'list', values: ['교통', '식비', '숙박', '회의', '사무용품', '기타'] } },
            { name: '내용', type: 'text', width: 200 },
            { name: '금액', type: 'currency', width: 120 },
            { name: '결제수단', type: 'text', width: 100, validation: { type: 'list', values: ['법인카드', '개인카드', '현금', '계좌이체'] } },
            { name: '승인상태', type: 'text', width: 80, validation: { type: 'list', values: ['대기', '승인', '반려'] } },
            { name: '비고', type: 'text', width: 150 },
        ],
        formulas: [],
        conditionalFormats: [
            {
                range: 'F2:F100',
                condition: { type: 'equal', value: '승인' },
                style: { backgroundColor: '#90EE90' },
            },
            {
                range: 'F2:F100',
                condition: { type: 'equal', value: '반려' },
                style: { backgroundColor: '#FFB6C1' },
            },
        ],
        frozenRows: 1,
    },
    project_tracker: {
        name: '프로젝트 관리',
        description: '프로젝트 진행 상황을 관리하는 시트입니다.',
        columns: [
            { name: '프로젝트명', type: 'text', width: 180 },
            { name: '담당자', type: 'text', width: 100 },
            { name: '시작일', type: 'date', width: 100 },
            { name: '마감일', type: 'date', width: 100 },
            { name: '진행률', type: 'percent', width: 80 },
            { name: '상태', type: 'text', width: 80, validation: { type: 'list', values: ['시작전', '진행중', '완료', '보류'] } },
            { name: '우선순위', type: 'text', width: 80, validation: { type: 'list', values: ['높음', '중간', '낮음'] } },
            { name: 'D-Day', type: 'formula', width: 80, formula: '=D{row}-TODAY()' },
        ],
        formulas: [
            { column: 7, formula: '=D{row}-TODAY()', applyToAllRows: true },
        ],
        conditionalFormats: [
            {
                range: 'E2:E100',
                condition: { type: 'equal', value: 100 },
                style: { backgroundColor: '#90EE90' },
            },
            {
                range: 'H2:H100',
                condition: { type: 'less', value: 0 },
                style: { backgroundColor: '#FF6B6B', textColor: '#FFFFFF' },
            },
        ],
        frozenRows: 1,
    },
};

@Injectable()
export class SheetBuilderService {
    private readonly logger = new Logger(SheetBuilderService.name);
    private readonly openaiApiKey: string | undefined;

    constructor(private readonly configService: ConfigService) {
        this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    }

    /**
     * Generate sheet structure from natural language description
     */
    async generateSheetFromPrompt(prompt: string): Promise<SheetBuildResult> {
        const lowerPrompt = prompt.toLowerCase();

        // Try template matching first
        const templateResult = this.matchTemplate(lowerPrompt);
        if (templateResult) {
            return templateResult;
        }

        // If OpenAI is available, use LLM generation
        if (this.openaiApiKey) {
            return this.generateWithLLM(prompt);
        }

        // Fallback: Return a basic template based on keywords
        return this.generateBasicSheet(prompt);
    }

    /**
     * Match prompt to predefined templates
     */
    private matchTemplate(prompt: string): SheetBuildResult | null {
        // Customer management keywords
        if (prompt.includes('고객') || prompt.includes('customer') || prompt.includes('crm')) {
            return this.buildFromDSL(SHEET_TEMPLATES.customer_management);
        }

        // Sales report keywords
        if (prompt.includes('매출') || prompt.includes('판매') || prompt.includes('sales')) {
            return this.buildFromDSL(SHEET_TEMPLATES.sales_report);
        }

        // Inventory keywords
        if (prompt.includes('재고') || prompt.includes('inventory') || prompt.includes('stock')) {
            return this.buildFromDSL(SHEET_TEMPLATES.inventory_tracker);
        }

        // Expense keywords
        if (prompt.includes('경비') || prompt.includes('지출') || prompt.includes('expense')) {
            return this.buildFromDSL(SHEET_TEMPLATES.expense_tracker);
        }

        // Project keywords
        if (prompt.includes('프로젝트') || prompt.includes('project') || prompt.includes('일정')) {
            return this.buildFromDSL(SHEET_TEMPLATES.project_tracker);
        }

        return null;
    }

    /**
     * Build sheet data from DSL
     */
    private buildFromDSL(dsl: SheetDSL): SheetBuildResult {
        const cells: CellData[][] = [];

        // Create header row
        const headerRow: CellData[] = dsl.columns.map(col => ({
            value: col.name,
            format: {
                backgroundColor: '#4A90D9',
                textColor: '#FFFFFF',
                bold: true,
            },
        }));
        cells.push(headerRow);

        // Create sample data rows (5 empty rows with formulas)
        for (let rowIdx = 0; rowIdx < 5; rowIdx++) {
            const dataRow: CellData[] = dsl.columns.map((col, colIdx) => {
                const cell: CellData = {};

                if (col.formula) {
                    cell.formula = col.formula.replace(/{row}/g, String(rowIdx + 2));
                }

                // Apply number format based on column type
                if (col.type === 'currency') {
                    cell.format = { numberFormat: '#,##0' };
                } else if (col.type === 'percent') {
                    cell.format = { numberFormat: '0.0%' };
                } else if (col.type === 'date') {
                    cell.format = { numberFormat: 'YYYY-MM-DD' };
                }

                return cell;
            });
            cells.push(dataRow);
        }

        return {
            dsl,
            cells,
            explanation: `"${dsl.name}" 시트를 생성했습니다. ${dsl.columns.length}개의 컬럼과 ${dsl.conditionalFormats.length}개의 조건부 서식이 포함되어 있습니다.`,
            confidence: 0.95,
        };
    }

    /**
     * Generate sheet using LLM
     */
    private async generateWithLLM(prompt: string): Promise<SheetBuildResult> {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a spreadsheet structure designer. Generate a JSON sheet structure based on user requests.
              
Respond with JSON in this format:
{
  "name": "Sheet Name in Korean",
  "description": "Brief description in Korean",
  "columns": [
    {"name": "Column Name", "type": "text|number|date|currency|percent|formula", "width": 100, "formula": "=formula if type is formula"}
  ],
  "conditionalFormats": [
    {"range": "A2:A100", "condition": {"type": "greater", "value": 0}, "style": {"backgroundColor": "#90EE90"}}
  ],
  "frozenRows": 1
}

Use Korean column names. Include relevant formulas and conditional formatting for business use cases.`,
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.5,
                    max_tokens: 1500,
                }),
            });

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                try {
                    // Extract JSON from response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]) as SheetDSL;
                        parsed.formulas = parsed.formulas || [];
                        return this.buildFromDSL(parsed);
                    }
                } catch (parseError) {
                    this.logger.error('Failed to parse LLM response:', parseError);
                }
            }
        } catch (error) {
            this.logger.error('LLM sheet generation failed:', error);
        }

        return this.generateBasicSheet(prompt);
    }

    /**
     * Generate a basic sheet as fallback
     */
    private generateBasicSheet(prompt: string): SheetBuildResult {
        const basicDSL: SheetDSL = {
            name: '새 시트',
            description: prompt,
            columns: [
                { name: '항목', type: 'text', width: 150 },
                { name: '값', type: 'number', width: 100 },
                { name: '날짜', type: 'date', width: 100 },
                { name: '비고', type: 'text', width: 200 },
            ],
            formulas: [],
            conditionalFormats: [],
            frozenRows: 1,
        };

        return {
            ...this.buildFromDSL(basicDSL),
            explanation: `"${prompt}"에 기반한 기본 시트를 생성했습니다. 필요에 따라 컬럼을 수정해주세요.`,
            confidence: 0.6,
        };
    }

    /**
     * Get available templates
     */
    getTemplates(): { key: string; name: string; description: string }[] {
        return Object.entries(SHEET_TEMPLATES).map(([key, template]) => ({
            key,
            name: template.name,
            description: template.description || '',
        }));
    }

    /**
     * Build sheet from template key
     */
    buildFromTemplate(templateKey: string): SheetBuildResult | null {
        const template = SHEET_TEMPLATES[templateKey];
        if (!template) {
            return null;
        }
        return this.buildFromDSL(template);
    }
}
