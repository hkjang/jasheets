import { Injectable, Logger } from '@nestjs/common';
import { NormalizerService } from '../normalizer/normalizer.service';

// Documentation Types
export interface ColumnDoc {
    index: number;
    name: string;
    dataType: string;
    description: string;
    statistics: {
        count: number;
        unique: number;
        missing: number;
        sampleValues: any[];
    };
    constraints?: string[];
    relatedColumns?: string[];
}

export interface FormulaDoc {
    cell: string;
    formula: string;
    description: string;
    dependencies: string[];
}

export interface RelationshipDoc {
    type: 'lookup' | 'reference' | 'calculation';
    sourceColumn: string;
    targetColumn: string;
    description: string;
}

export interface SheetDocumentation {
    sheetName: string;
    description: string;
    columns: ColumnDoc[];
    formulas: FormulaDoc[];
    relationships: RelationshipDoc[];
    metadata: {
        createdAt: Date;
        totalRows: number;
        totalCols: number;
    };
}

export interface DataDictionary {
    title: string;
    version: string;
    generatedAt: Date;
    sheets: SheetDocumentation[];
    glossary: { term: string; definition: string }[];
}

@Injectable()
export class DocumentationService {
    private readonly logger = new Logger(DocumentationService.name);

    constructor(private readonly normalizerService: NormalizerService) { }

    /**
     * Generate documentation for a sheet
     */
    async generateSheetDocumentation(
        data: any[][],
        options: {
            sheetName?: string;
            headers?: string[];
            includeFormulas?: boolean;
            includeRelationships?: boolean;
        } = {},
    ): Promise<SheetDocumentation> {
        const {
            sheetName = 'Sheet',
            headers,
            includeFormulas = true,
            includeRelationships = true,
        } = options;

        const totalRows = data.length;
        const totalCols = data[0]?.length || 0;

        // Generate column documentation
        const columns: ColumnDoc[] = [];
        for (let col = 0; col < totalCols; col++) {
            const columnData = data.map(row => row[col]);
            const columnName = headers?.[col] || this.colToLetter(col);
            const columnDoc = this.documentColumn(columnData, col, columnName);
            columns.push(columnDoc);
        }

        // Extract formulas
        const formulas: FormulaDoc[] = includeFormulas
            ? this.extractFormulas(data, headers)
            : [];

        // Detect relationships
        const relationships: RelationshipDoc[] = includeRelationships
            ? this.detectRelationships(columns, formulas)
            : [];

        return {
            sheetName,
            description: this.generateSheetDescription(columns, totalRows),
            columns,
            formulas,
            relationships,
            metadata: {
                createdAt: new Date(),
                totalRows,
                totalCols,
            },
        };
    }

    /**
     * Document a single column
     */
    private documentColumn(data: any[], index: number, name: string): ColumnDoc {
        const nonEmpty = data.filter(v => v != null && v !== '');
        const detected = this.normalizerService.analyzeColumnTypes([data]);
        const dataType = detected[0]?.type || 'unknown';

        // Get sample values (first 5 unique non-empty values)
        const uniqueValues = [...new Set(nonEmpty.map(String))].slice(0, 5);
        const sampleValues = uniqueValues.map(v => {
            const original = nonEmpty.find(d => String(d) === v);
            return original;
        });

        // Generate description based on data type and name
        const description = this.generateColumnDescription(name, dataType, nonEmpty.length, data.length);

        // Detect constraints
        const constraints = this.detectConstraints(nonEmpty, dataType);

        return {
            index,
            name,
            dataType,
            description,
            statistics: {
                count: data.length,
                unique: new Set(nonEmpty.map(String)).size,
                missing: data.length - nonEmpty.length,
                sampleValues,
            },
            constraints,
        };
    }

    /**
     * Generate column description
     */
    private generateColumnDescription(name: string, dataType: string, nonEmpty: number, total: number): string {
        const typeDescriptions: Record<string, string> = {
            numeric: '숫자 데이터를 포함합니다.',
            text: '텍스트 데이터를 포함합니다.',
            date: '날짜 데이터를 포함합니다.',
            currency: '통화/금액 데이터를 포함합니다.',
            email: '이메일 주소를 포함합니다.',
            phone: '전화번호를 포함합니다.',
            boolean: '참/거짓 값을 포함합니다.',
            mixed: '여러 유형의 데이터가 혼합되어 있습니다.',
        };

        const typeDesc = typeDescriptions[dataType] || '데이터를 포함합니다.';
        const missingPercent = total > 0 ? ((total - nonEmpty) / total * 100).toFixed(1) : '0';

        return `${name} 컬럼은 ${typeDesc} 총 ${total}개 행 중 ${nonEmpty}개가 입력되어 있습니다 (결측치 ${missingPercent}%).`;
    }

    /**
     * Detect constraints on a column
     */
    private detectConstraints(data: any[], dataType: string): string[] {
        const constraints: string[] = [];

        if (new Set(data.map(String)).size === data.length) {
            constraints.push('고유값 (중복 없음)');
        }

        if (dataType === 'numeric') {
            const numbers = data.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number);
            if (numbers.length > 0) {
                if (numbers.every(n => n >= 0)) {
                    constraints.push('양수 또는 0');
                }
                if (numbers.every(n => Number.isInteger(n))) {
                    constraints.push('정수');
                }
            }
        }

        if (dataType === 'text') {
            const lengths = data.filter(v => typeof v === 'string').map(v => (v as string).length);
            if (lengths.length > 0) {
                const maxLength = Math.max(...lengths);
                if (maxLength <= 50) {
                    constraints.push(`최대 길이: ${maxLength}자`);
                }
            }
        }

        return constraints;
    }

    /**
     * Extract formulas from data
     */
    private extractFormulas(data: any[][], headers?: string[]): FormulaDoc[] {
        const formulas: FormulaDoc[] = [];

        for (let row = 0; row < data.length; row++) {
            for (let col = 0; col < data[row].length; col++) {
                const value = data[row][col];
                if (typeof value === 'string' && value.startsWith('=')) {
                    const cell = `${this.colToLetter(col)}${row + 1}`;
                    formulas.push({
                        cell,
                        formula: value,
                        description: this.describeFormula(value),
                        dependencies: this.extractDependencies(value),
                    });
                }
            }
        }

        return formulas;
    }

    /**
     * Describe a formula
     */
    private describeFormula(formula: string): string {
        const funcMatch = formula.match(/=(\w+)\(/);
        if (!funcMatch) return '계산 수식';

        const funcDescriptions: Record<string, string> = {
            SUM: '합계를 계산합니다.',
            AVERAGE: '평균을 계산합니다.',
            COUNT: '개수를 셉니다.',
            IF: '조건에 따라 다른 값을 반환합니다.',
            VLOOKUP: '값을 검색하여 반환합니다.',
            MAX: '최대값을 찾습니다.',
            MIN: '최소값을 찾습니다.',
        };

        return funcDescriptions[funcMatch[1].toUpperCase()] || `${funcMatch[1]} 함수를 사용합니다.`;
    }

    /**
     * Extract cell dependencies from formula
     */
    private extractDependencies(formula: string): string[] {
        const cellPattern = /[A-Z]+\d+/g;
        const matches = formula.match(cellPattern);
        return matches ? [...new Set(matches)] : [];
    }

    /**
     * Detect relationships between columns
     */
    private detectRelationships(columns: ColumnDoc[], formulas: FormulaDoc[]): RelationshipDoc[] {
        const relationships: RelationshipDoc[] = [];

        // Detect calculation relationships from formulas
        for (const formula of formulas) {
            for (const dep of formula.dependencies) {
                const colMatch = dep.match(/([A-Z]+)/);
                if (colMatch) {
                    const sourceColIndex = this.letterToCol(colMatch[1]);
                    const targetColMatch = formula.cell.match(/([A-Z]+)/);
                    if (targetColMatch) {
                        const targetColIndex = this.letterToCol(targetColMatch[1]);
                        const sourceCol = columns.find(c => c.index === sourceColIndex);
                        const targetCol = columns.find(c => c.index === targetColIndex);

                        if (sourceCol && targetCol) {
                            relationships.push({
                                type: 'calculation',
                                sourceColumn: sourceCol.name,
                                targetColumn: targetCol.name,
                                description: `${sourceCol.name}이(가) ${targetCol.name} 계산에 사용됩니다.`,
                            });
                        }
                    }
                }
            }
        }

        // Detect potential lookup relationships by name similarity
        for (let i = 0; i < columns.length; i++) {
            for (let j = i + 1; j < columns.length; j++) {
                const col1 = columns[i];
                const col2 = columns[j];

                if (col1.name.includes('ID') && col2.name.includes('ID')) {
                    relationships.push({
                        type: 'reference',
                        sourceColumn: col1.name,
                        targetColumn: col2.name,
                        description: 'ID 기반 참조 관계가 있을 수 있습니다.',
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Generate sheet description
     */
    private generateSheetDescription(columns: ColumnDoc[], totalRows: number): string {
        const typeCounts: Record<string, number> = {};
        columns.forEach(c => {
            typeCounts[c.dataType] = (typeCounts[c.dataType] || 0) + 1;
        });

        const typeList = Object.entries(typeCounts)
            .map(([type, count]) => `${type} ${count}개`)
            .join(', ');

        return `이 시트는 ${columns.length}개의 컬럼과 ${totalRows}개의 행으로 구성되어 있습니다. 컬럼 유형: ${typeList}.`;
    }

    /**
     * Generate Markdown documentation
     */
    generateMarkdown(doc: SheetDocumentation): string {
        let md = `# ${doc.sheetName} 문서\n\n`;
        md += `> ${doc.description}\n\n`;
        md += `생성일: ${doc.metadata.createdAt.toLocaleDateString('ko-KR')}\n\n`;

        // Columns section
        md += `## 컬럼 정의\n\n`;
        md += `| # | 컬럼명 | 데이터 타입 | 설명 | 결측치 |\n`;
        md += `|---|--------|-------------|------|--------|\n`;

        for (const col of doc.columns) {
            const missing = col.statistics.count > 0
                ? ((col.statistics.missing / col.statistics.count) * 100).toFixed(1) + '%'
                : '0%';
            md += `| ${col.index + 1} | ${col.name} | ${col.dataType} | ${col.description.substring(0, 50)}... | ${missing} |\n`;
        }

        md += `\n### 컬럼 상세\n\n`;
        for (const col of doc.columns) {
            md += `#### ${col.name}\n\n`;
            md += `- **데이터 타입**: ${col.dataType}\n`;
            md += `- **고유값 수**: ${col.statistics.unique}\n`;
            md += `- **결측치**: ${col.statistics.missing}개\n`;
            if (col.constraints && col.constraints.length > 0) {
                md += `- **제약조건**: ${col.constraints.join(', ')}\n`;
            }
            md += `- **샘플 값**: ${col.statistics.sampleValues.slice(0, 3).join(', ')}\n\n`;
        }

        // Formulas section
        if (doc.formulas.length > 0) {
            md += `## 수식\n\n`;
            md += `| 셀 | 수식 | 설명 |\n`;
            md += `|----|------|------|\n`;
            for (const formula of doc.formulas.slice(0, 10)) {
                md += `| ${formula.cell} | \`${formula.formula}\` | ${formula.description} |\n`;
            }
            if (doc.formulas.length > 10) {
                md += `\n*... 외 ${doc.formulas.length - 10}개의 수식*\n`;
            }
        }

        // Relationships section
        if (doc.relationships.length > 0) {
            md += `\n## 데이터 관계\n\n`;
            for (const rel of doc.relationships) {
                md += `- **${rel.sourceColumn}** → **${rel.targetColumn}** (${rel.type}): ${rel.description}\n`;
            }
        }

        md += `\n---\n*이 문서는 자동으로 생성되었습니다.*\n`;

        return md;
    }

    /**
     * Generate data dictionary for multiple sheets
     */
    async generateDataDictionary(
        sheets: { name: string; data: any[][]; headers?: string[] }[],
        title: string = '데이터 사전',
    ): Promise<DataDictionary> {
        const sheetDocs: SheetDocumentation[] = [];

        for (const sheet of sheets) {
            const doc = await this.generateSheetDocumentation(sheet.data, {
                sheetName: sheet.name,
                headers: sheet.headers,
            });
            sheetDocs.push(doc);
        }

        // Generate glossary from column names
        const glossary: { term: string; definition: string }[] = [];
        const seenTerms = new Set<string>();

        for (const doc of sheetDocs) {
            for (const col of doc.columns) {
                if (!seenTerms.has(col.name)) {
                    seenTerms.add(col.name);
                    glossary.push({
                        term: col.name,
                        definition: col.description,
                    });
                }
            }
        }

        return {
            title,
            version: '1.0',
            generatedAt: new Date(),
            sheets: sheetDocs,
            glossary,
        };
    }

    /**
     * Convert column letter to index
     */
    private letterToCol(letters: string): number {
        let col = 0;
        for (let i = 0; i < letters.length; i++) {
            col = col * 26 + (letters.charCodeAt(i) - 64);
        }
        return col - 1;
    }

    /**
     * Convert column index to letter
     */
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
