import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FormulaContext {
  selectedRange?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  nearbyData?: any[][];
  columnHeaders?: string[];
  sheetName: string;
}

export interface FormulaResult {
  formula: string;
  explanation: string;
  confidence: number;
  alternatives?: string[];
}

export interface AutoFillResult {
  values: any[][];
  pattern?: string;
}

export interface ChartRecommendation {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  confidence: number;
  reason: string;
}

export interface DataSummary {
  totalRows: number;
  totalCols: number;
  statistics: {
    column: string;
    type: 'numeric' | 'text' | 'date' | 'mixed';
    count: number;
    unique?: number;
    min?: number;
    max?: number;
    average?: number;
    sum?: number;
  }[];
  insights: string[];
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly openaiApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  // Natural language to formula conversion
  async generateFormula(prompt: string, context: FormulaContext): Promise<FormulaResult> {
    // First, try pattern matching for common requests
    const patternResult = this.tryPatternMatch(prompt, context);
    if (patternResult) {
      return patternResult;
    }

    // If OpenAI API key is available, use it
    if (this.openaiApiKey) {
      return this.generateFormulaWithLLM(prompt, context);
    }

    // Fallback to rule-based generation
    return this.generateFormulaRuleBased(prompt, context);
  }

  // Prompt templates for common business formulas
  private readonly promptTemplates = {
    growthRate: {
      keywords: ['증감률', '성장률', '변화율', 'growth rate', 'change rate', '증가율', '감소율'],
      formula: (prev: string, curr: string) => `=(${curr}-${prev})/${prev}*100`,
      explanation: '두 값 사이의 증감률을 퍼센트로 계산합니다. (현재값-이전값)/이전값*100',
    },
    profitMargin: {
      keywords: ['이익률', '수익률', '마진', 'profit margin', 'margin', '영업이익률'],
      formula: (revenue: string, cost: string) => `=(${revenue}-${cost})/${revenue}*100`,
      explanation: '수익 대비 이익의 비율을 계산합니다.',
    },
    yoyComparison: {
      keywords: ['전년대비', '전년동기대비', 'yoy', 'year over year', '작년대비'],
      formula: (thisYear: string, lastYear: string) => `=(${thisYear}-${lastYear})/${lastYear}*100`,
      explanation: '전년 동기 대비 증감률을 계산합니다.',
    },
    movingAverage: {
      keywords: ['이동평균', 'moving average', 'ma', '평활', '추세'],
      formula: (range: string) => `=AVERAGE(${range})`,
      explanation: '지정된 구간의 이동 평균을 계산합니다.',
    },
    variance: {
      keywords: ['분산', 'variance', 'var', '변동성'],
      formula: (range: string) => `=VAR(${range})`,
      explanation: '데이터의 분산을 계산합니다.',
    },
    standardDeviation: {
      keywords: ['표준편차', 'standard deviation', 'std', 'stdev'],
      formula: (range: string) => `=STDEV(${range})`,
      explanation: '데이터의 표준편차를 계산합니다.',
    },
    rankPercentile: {
      keywords: ['순위', 'rank', '백분위', 'percentile', '등수'],
      formula: (value: string, range: string) => `=RANK(${value},${range})`,
      explanation: '범위 내에서 값의 순위를 계산합니다.',
    },
    cumulative: {
      keywords: ['누적', 'cumulative', '누계', '총누적', 'running total'],
      formula: (cell: string, startRow: string) => `=SUM($A$${startRow}:${cell})`,
      explanation: '시작 셀부터 현재 셀까지의 누적 합계를 계산합니다.',
    },
    weightedAverage: {
      keywords: ['가중평균', 'weighted average', '가중치평균'],
      formula: (values: string, weights: string) => `=SUMPRODUCT(${values},${weights})/SUM(${weights})`,
      explanation: '가중치를 적용한 평균을 계산합니다.',
    },
    compoundGrowth: {
      keywords: ['복리', '복합성장률', 'cagr', 'compound growth', '연평균성장률'],
      formula: (start: string, end: string, years: string) => `=POWER(${end}/${start},1/${years})-1`,
      explanation: '연평균 복합 성장률(CAGR)을 계산합니다.',
    },
  };

  // Pattern matching for common formula requests
  private tryPatternMatch(prompt: string, context: FormulaContext): FormulaResult | null {
    const lowerPrompt = prompt.toLowerCase();
    const range = context.selectedRange;
    const rangeStr = range
      ? `${this.colToLetter(range.startCol)}${range.startRow + 1}:${this.colToLetter(range.endCol)}${range.endRow + 1}`
      : 'A1:A10';

    // Get start and end cells for two-value formulas
    const startCell = range
      ? `${this.colToLetter(range.startCol)}${range.startRow + 1}`
      : 'A1';
    const endCell = range
      ? `${this.colToLetter(range.endCol)}${range.endRow + 1}`
      : 'B1';

    // === Business Formula Patterns ===

    // Growth Rate / 증감률 patterns
    if (this.promptTemplates.growthRate.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: this.promptTemplates.growthRate.formula(startCell, endCell),
        explanation: this.promptTemplates.growthRate.explanation,
        confidence: 0.92,
        alternatives: [
          `=IFERROR((${endCell}-${startCell})/${startCell}*100, 0)`,
          `=(${endCell}/${startCell}-1)*100`,
        ],
      };
    }

    // Profit Margin / 이익률 patterns
    if (this.promptTemplates.profitMargin.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: this.promptTemplates.profitMargin.formula(startCell, endCell),
        explanation: this.promptTemplates.profitMargin.explanation,
        confidence: 0.9,
        alternatives: [
          `=IFERROR((${startCell}-${endCell})/${startCell}*100, 0)`,
        ],
      };
    }

    // YoY Comparison / 전년대비 patterns
    if (this.promptTemplates.yoyComparison.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: this.promptTemplates.yoyComparison.formula(endCell, startCell),
        explanation: this.promptTemplates.yoyComparison.explanation,
        confidence: 0.9,
        alternatives: [
          `=${endCell}-${startCell}`,
          `=IFERROR((${endCell}-${startCell})/${startCell}*100, "N/A")`,
        ],
      };
    }

    // Variance / 분산 patterns
    if (this.promptTemplates.variance.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=VAR(${rangeStr})`,
        explanation: this.promptTemplates.variance.explanation,
        confidence: 0.93,
        alternatives: [`=VAR.P(${rangeStr})`, `=VAR.S(${rangeStr})`],
      };
    }

    // Standard Deviation / 표준편차 patterns
    if (this.promptTemplates.standardDeviation.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=STDEV(${rangeStr})`,
        explanation: this.promptTemplates.standardDeviation.explanation,
        confidence: 0.93,
        alternatives: [`=STDEV.P(${rangeStr})`, `=STDEV.S(${rangeStr})`],
      };
    }

    // Rank / 순위 patterns
    if (this.promptTemplates.rankPercentile.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=RANK(${startCell},${rangeStr})`,
        explanation: this.promptTemplates.rankPercentile.explanation,
        confidence: 0.88,
        alternatives: [
          `=RANK(${startCell},${rangeStr},1)`,
          `=PERCENTRANK(${rangeStr},${startCell})`,
        ],
      };
    }

    // Cumulative / 누적 patterns
    if (this.promptTemplates.cumulative.keywords.some(k => lowerPrompt.includes(k))) {
      const startRow = range ? range.startRow + 1 : 1;
      return {
        formula: `=SUM($${this.colToLetter(range?.startCol || 0)}$${startRow}:${startCell})`,
        explanation: this.promptTemplates.cumulative.explanation,
        confidence: 0.88,
        alternatives: [`=SUMIF($A$1:${startCell},">0")`],
      };
    }

    // Weighted Average / 가중평균 patterns
    if (this.promptTemplates.weightedAverage.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=SUMPRODUCT(A:A,B:B)/SUM(B:B)`,
        explanation: this.promptTemplates.weightedAverage.explanation,
        confidence: 0.85,
        alternatives: [`=SUMPRODUCT(${rangeStr},C:C)/SUM(C:C)`],
      };
    }

    // Compound Growth / 복리성장률 patterns
    if (this.promptTemplates.compoundGrowth.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=POWER(${endCell}/${startCell},1/5)-1`,
        explanation: this.promptTemplates.compoundGrowth.explanation,
        confidence: 0.85,
        alternatives: [`=(${endCell}/${startCell})^(1/5)-1`],
      };
    }

    // Moving Average / 이동평균 patterns
    if (this.promptTemplates.movingAverage.keywords.some(k => lowerPrompt.includes(k))) {
      return {
        formula: `=AVERAGE(${rangeStr})`,
        explanation: this.promptTemplates.movingAverage.explanation,
        confidence: 0.88,
        alternatives: [
          `=AVERAGE(OFFSET(${startCell},-2,0,3,1))`,
          `=AVERAGE(INDIRECT("A"&(ROW()-2)&":A"&ROW()))`,
        ],
      };
    }

    // === Basic Formula Patterns ===

    // Sum patterns
    if (lowerPrompt.includes('합계') || lowerPrompt.includes('sum') || lowerPrompt.includes('더해') || lowerPrompt.includes('총합')) {
      return {
        formula: `=SUM(${rangeStr})`,
        explanation: '선택한 범위의 모든 숫자를 더합니다.',
        confidence: 0.95,
        alternatives: [`=SUMIF(${rangeStr},">0")`, `=SUMPRODUCT(${rangeStr})`],
      };
    }

    // Average patterns
    if (lowerPrompt.includes('평균') || lowerPrompt.includes('average') || lowerPrompt.includes('mean')) {
      return {
        formula: `=AVERAGE(${rangeStr})`,
        explanation: '선택한 범위의 평균값을 계산합니다.',
        confidence: 0.95,
        alternatives: [`=AVERAGEIF(${rangeStr},">0")`],
      };
    }

    // Count patterns
    if (lowerPrompt.includes('개수') || lowerPrompt.includes('count') || lowerPrompt.includes('몇 개')) {
      return {
        formula: `=COUNT(${rangeStr})`,
        explanation: '선택한 범위에서 숫자가 포함된 셀의 개수를 셉니다.',
        confidence: 0.9,
        alternatives: [`=COUNTA(${rangeStr})`, `=COUNTBLANK(${rangeStr})`],
      };
    }

    // Max/Min patterns
    if (lowerPrompt.includes('최대') || lowerPrompt.includes('maximum') || lowerPrompt.includes('max') || lowerPrompt.includes('가장 큰')) {
      return {
        formula: `=MAX(${rangeStr})`,
        explanation: '선택한 범위에서 가장 큰 값을 찾습니다.',
        confidence: 0.95,
      };
    }

    if (lowerPrompt.includes('최소') || lowerPrompt.includes('minimum') || lowerPrompt.includes('min') || lowerPrompt.includes('가장 작은')) {
      return {
        formula: `=MIN(${rangeStr})`,
        explanation: '선택한 범위에서 가장 작은 값을 찾습니다.',
        confidence: 0.95,
      };
    }

    // Median / 중위수 patterns
    if (lowerPrompt.includes('중위수') || lowerPrompt.includes('중앙값') || lowerPrompt.includes('median')) {
      return {
        formula: `=MEDIAN(${rangeStr})`,
        explanation: '데이터의 중앙값(중위수)을 계산합니다.',
        confidence: 0.93,
      };
    }

    // Mode / 최빈값 patterns
    if (lowerPrompt.includes('최빈값') || lowerPrompt.includes('최빈수') || lowerPrompt.includes('mode')) {
      return {
        formula: `=MODE(${rangeStr})`,
        explanation: '가장 자주 나타나는 값을 찾습니다.',
        confidence: 0.9,
        alternatives: [`=MODE.MULT(${rangeStr})`],
      };
    }

    // Conditional patterns
    if (lowerPrompt.includes('만약') || lowerPrompt.includes('if') || lowerPrompt.includes('조건')) {
      return {
        formula: `=IF(A1>0, "양수", "음수 또는 0")`,
        explanation: '조건에 따라 다른 값을 반환합니다. 조건을 수정해주세요.',
        confidence: 0.7,
        alternatives: [`=IFS(A1>0,"양수",A1<0,"음수",TRUE,"0")`],
      };
    }

    // Lookup patterns
    if (lowerPrompt.includes('찾기') || lowerPrompt.includes('lookup') || lowerPrompt.includes('vlookup') || lowerPrompt.includes('검색')) {
      return {
        formula: `=VLOOKUP(A1, ${rangeStr}, 2, FALSE)`,
        explanation: '첫 번째 열에서 값을 찾아 해당 행의 두 번째 열 값을 반환합니다.',
        confidence: 0.8,
        alternatives: [`=INDEX(B:B, MATCH(A1, A:A, 0))`],
      };
    }

    // Percentage patterns
    if (lowerPrompt.includes('퍼센트') || lowerPrompt.includes('percent') || lowerPrompt.includes('%') || lowerPrompt.includes('비율')) {
      return {
        formula: `=A1/SUM(${rangeStr})*100`,
        explanation: '전체 대비 비율을 퍼센트로 계산합니다.',
        confidence: 0.85,
      };
    }

    // Round / 반올림 patterns
    if (lowerPrompt.includes('반올림') || lowerPrompt.includes('round')) {
      return {
        formula: `=ROUND(${startCell}, 2)`,
        explanation: '지정된 자릿수로 반올림합니다.',
        confidence: 0.9,
        alternatives: [`=ROUNDUP(${startCell}, 2)`, `=ROUNDDOWN(${startCell}, 2)`],
      };
    }

    // Concatenate / 문자열 결합 patterns
    if (lowerPrompt.includes('결합') || lowerPrompt.includes('합치') || lowerPrompt.includes('concat') || lowerPrompt.includes('문자열')) {
      return {
        formula: `=CONCAT(${startCell}, " ", ${endCell})`,
        explanation: '여러 셀의 텍스트를 하나로 결합합니다.',
        confidence: 0.85,
        alternatives: [`=${startCell}&" "&${endCell}`, `=TEXTJOIN(" ", TRUE, ${rangeStr})`],
      };
    }

    // Date difference / 날짜 차이 patterns
    if (lowerPrompt.includes('날짜 차이') || lowerPrompt.includes('며칠') || lowerPrompt.includes('일수') || lowerPrompt.includes('기간')) {
      return {
        formula: `=DATEDIF(${startCell}, ${endCell}, "D")`,
        explanation: '두 날짜 사이의 일수를 계산합니다.',
        confidence: 0.88,
        alternatives: [`=${endCell}-${startCell}`, `=DATEDIF(${startCell}, ${endCell}, "M")`],
      };
    }

    return null;
  }

  // Rule-based formula generation (fallback)
  private generateFormulaRuleBased(prompt: string, context: FormulaContext): FormulaResult {
    const range = context.selectedRange;
    const rangeStr = range
      ? `${this.colToLetter(range.startCol)}${range.startRow + 1}:${this.colToLetter(range.endCol)}${range.endRow + 1}`
      : 'A1:A10';

    return {
      formula: `=SUM(${rangeStr})`,
      explanation: `"${prompt}"에 대한 수식을 생성했습니다. 필요에 따라 수정해주세요.`,
      confidence: 0.5,
      alternatives: [`=AVERAGE(${rangeStr})`, `=COUNT(${rangeStr})`],
    };
  }

  // Generate formula using LLM (OpenAI)
  private async generateFormulaWithLLM(prompt: string, context: FormulaContext): Promise<FormulaResult> {
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
              content: `You are a spreadsheet formula expert. Generate Excel/Google Sheets formulas based on user requests.
              
Context:
- Sheet name: ${context.sheetName}
- Selected range: ${context.selectedRange ? `${this.colToLetter(context.selectedRange.startCol)}${context.selectedRange.startRow + 1}:${this.colToLetter(context.selectedRange.endCol)}${context.selectedRange.endRow + 1}` : 'none'}
- Column headers: ${context.columnHeaders?.join(', ') || 'unknown'}

Respond in JSON format:
{
  "formula": "=FORMULA(...)",
  "explanation": "Brief explanation in Korean",
  "confidence": 0.9,
  "alternatives": ["=ALT1(...)", "=ALT2(...)"]
}`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        try {
          const parsed = JSON.parse(content);
          return {
            formula: parsed.formula || '=ERROR',
            explanation: parsed.explanation || '',
            confidence: parsed.confidence || 0.8,
            alternatives: parsed.alternatives,
          };
        } catch {
          // If JSON parsing fails, extract formula from text
          const formulaMatch = content.match(/=\w+\([^)]+\)/);
          return {
            formula: formulaMatch?.[0] || '=ERROR',
            explanation: content,
            confidence: 0.6,
          };
        }
      }
    } catch (error) {
      this.logger.error('LLM formula generation failed:', error);
    }

    return this.generateFormulaRuleBased(prompt, context);
  }

  // Explain a formula
  async explainFormula(formula: string): Promise<string> {
    // Pattern-based explanations
    const explanations: Record<string, string> = {
      'SUM': '범위 내 모든 숫자의 합계를 계산합니다.',
      'AVERAGE': '범위 내 숫자들의 평균값을 계산합니다.',
      'COUNT': '숫자가 포함된 셀의 개수를 셉니다.',
      'COUNTA': '비어있지 않은 셀의 개수를 셉니다.',
      'MAX': '범위 내 가장 큰 값을 반환합니다.',
      'MIN': '범위 내 가장 작은 값을 반환합니다.',
      'IF': '조건이 참이면 첫 번째 값을, 거짓이면 두 번째 값을 반환합니다.',
      'VLOOKUP': '첫 번째 열에서 값을 찾아 해당 행의 지정된 열 값을 반환합니다.',
      'SUMIF': '조건을 만족하는 셀들의 합계를 계산합니다.',
      'COUNTIF': '조건을 만족하는 셀의 개수를 셉니다.',
    };

    const funcMatch = formula.match(/=(\w+)\(/);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      if (explanations[funcName]) {
        return explanations[funcName];
      }
    }

    if (this.openaiApiKey) {
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
                content: 'Explain this spreadsheet formula in Korean, simply and concisely.',
              },
              {
                role: 'user',
                content: formula,
              },
            ],
            max_tokens: 200,
          }),
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '수식 설명을 생성할 수 없습니다.';
      } catch {
        return '수식 설명을 생성할 수 없습니다.';
      }
    }

    return '이 수식은 데이터를 계산하거나 조작합니다.';
  }

  // Suggest formula error fixes
  async suggestErrorFix(formula: string, errorType: string): Promise<{ suggestion: string; explanation: string }[]> {
    const suggestions: { suggestion: string; explanation: string }[] = [];

    if (errorType === '#REF!') {
      suggestions.push({
        suggestion: formula.replace(/#REF!/g, 'A1'),
        explanation: '잘못된 셀 참조를 수정하세요. 삭제된 셀이나 범위를 참조하고 있습니다.',
      });
    }

    if (errorType === '#VALUE!') {
      suggestions.push({
        suggestion: `=IFERROR(${formula}, 0)`,
        explanation: '값 오류가 발생할 경우 0을 반환하도록 처리합니다.',
      });
    }

    if (errorType === '#DIV/0!') {
      suggestions.push({
        suggestion: formula.replace(/\/(\w+)/, '/IF($1=0,1,$1)'),
        explanation: '0으로 나누는 것을 방지합니다.',
      });
    }

    if (errorType === '#NAME?') {
      suggestions.push({
        suggestion: formula,
        explanation: '함수 이름의 철자를 확인하세요. 존재하지 않는 함수나 이름을 참조하고 있습니다.',
      });
    }

    return suggestions;
  }

  // Auto-fill suggestions
  async suggestAutoFill(
    existingData: any[][],
    direction: 'down' | 'right',
    count: number,
  ): Promise<AutoFillResult> {
    if (existingData.length === 0) {
      return { values: [], pattern: 'No data' };
    }

    const flatData = direction === 'down'
      ? existingData.map(row => row[0])
      : existingData[0];

    // Detect pattern
    const pattern = this.detectPattern(flatData);
    const values: any[][] = [];

    for (let i = 0; i < count; i++) {
      const nextValue = this.generateNextValue(flatData, pattern, i);
      if (direction === 'down') {
        values.push([nextValue]);
      } else {
        if (i === 0) values.push([]);
        values[0].push(nextValue);
      }
    }

    return { values, pattern: pattern.type };
  }

  private detectPattern(data: any[]): { type: string; step?: number } {
    if (data.length < 2) return { type: 'constant' };

    // Check for numeric sequence
    const numbers = data.filter(v => typeof v === 'number');
    if (numbers.length === data.length) {
      const diffs = [];
      for (let i = 1; i < numbers.length; i++) {
        diffs.push(numbers[i] - numbers[i - 1]);
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const isLinear = diffs.every(d => Math.abs(d - avgDiff) < 0.001);
      if (isLinear) {
        return { type: 'linear', step: avgDiff };
      }
    }

    // Check for date sequence
    // ... (simplified for brevity)

    return { type: 'repeat' };
  }

  private generateNextValue(data: any[], pattern: { type: string; step?: number }, index: number): any {
    const lastValue = data[data.length - 1];

    switch (pattern.type) {
      case 'linear':
        return (lastValue as number) + (pattern.step || 1) * (index + 1);
      case 'repeat':
        return data[index % data.length];
      default:
        return lastValue;
    }
  }

  // Chart recommendation
  async recommendChart(data: any[][]): Promise<ChartRecommendation[]> {
    const recommendations: ChartRecommendation[] = [];

    if (data.length === 0 || data[0].length === 0) {
      return recommendations;
    }

    const hasNumericData = data.some(row => row.some(cell => typeof cell === 'number'));
    const rowCount = data.length;
    const colCount = data[0].length;

    // Single column of numbers - pie chart
    if (colCount === 2 && hasNumericData) {
      recommendations.push({
        type: 'pie',
        confidence: 0.8,
        reason: '카테고리별 비율을 보여주기에 적합합니다.',
      });
    }

    // Time series data - line chart
    if (colCount >= 2 && rowCount > 5) {
      recommendations.push({
        type: 'line',
        confidence: 0.85,
        reason: '시간에 따른 추세를 보여주기에 적합합니다.',
      });
    }

    // Comparison data - bar chart
    if (hasNumericData) {
      recommendations.push({
        type: 'bar',
        confidence: 0.75,
        reason: '값을 비교하기에 적합합니다.',
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  // Data summarization
  async summarizeData(data: any[][], headers?: string[]): Promise<DataSummary> {
    const totalRows = data.length;
    const totalCols = data[0]?.length || 0;
    const statistics: DataSummary['statistics'] = [];
    const insights: string[] = [];

    for (let col = 0; col < totalCols; col++) {
      const columnData = data.map(row => row[col]).filter(v => v != null);
      const numbers = columnData.filter(v => typeof v === 'number') as number[];
      const isNumeric = numbers.length === columnData.length && numbers.length > 0;

      const stat: DataSummary['statistics'][0] = {
        column: headers?.[col] || this.colToLetter(col),
        type: isNumeric ? 'numeric' : 'text',
        count: columnData.length,
        unique: new Set(columnData.map(String)).size,
      };

      if (isNumeric && numbers.length > 0) {
        stat.min = Math.min(...numbers);
        stat.max = Math.max(...numbers);
        stat.average = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        stat.sum = numbers.reduce((a, b) => a + b, 0);

        // Generate insights
        if (stat.sum !== undefined) {
          insights.push(`${stat.column}의 총합: ${stat.sum.toLocaleString()}`);
        }
      }

      statistics.push(stat);
    }

    if (totalRows > 0) {
      insights.push(`총 ${totalRows}개의 데이터 행이 있습니다.`);
    }

    return { totalRows, totalCols, statistics, insights };
  }

  private colToLetter(col: number): string {
    let result = '';
    let num = col + 1;
    while (num > 0) {
      const remainder = (num - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      num = Math.floor((num - 1) / 26);
    }
    return result;
  }
}
