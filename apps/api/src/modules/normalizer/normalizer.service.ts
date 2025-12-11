import { Injectable, Logger } from '@nestjs/common';

// Normalization rule types
export interface NormalizationRule {
    type: 'date' | 'currency' | 'number' | 'text' | 'phone' | 'email';
    pattern: RegExp;
    transform: (value: string) => any;
    format?: string;
}

export interface NormalizationResult {
    originalValue: any;
    normalizedValue: any;
    type: string;
    confidence: number;
    changed: boolean;
}

export interface NormalizationReport {
    totalCells: number;
    normalizedCells: number;
    changes: {
        row: number;
        col: number;
        original: any;
        normalized: any;
        type: string;
    }[];
    detectedTypes: Record<string, number>;
}

// Predefined normalization rules
const DATE_PATTERNS: { pattern: RegExp; format: string }[] = [
    // Korean date formats
    { pattern: /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/, format: 'YYYY년 MM월 DD일' },
    { pattern: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, format: 'YYYY.MM.DD' },
    { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, format: 'YYYY-MM-DD' },
    { pattern: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, format: 'YYYY/MM/DD' },
    // US date formats
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: 'MM/DD/YYYY' },
    { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: 'MM-DD-YYYY' },
    // European date formats
    { pattern: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, format: 'DD.MM.YYYY' },
    // Month name formats
    { pattern: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})$/i, format: 'Mon DD, YYYY' },
    { pattern: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i, format: 'DD Mon YYYY' },
];

const CURRENCY_PATTERNS: { pattern: RegExp; currency: string }[] = [
    // Korean Won
    { pattern: /^₩\s*([\d,]+(?:\.\d+)?)$/, currency: 'KRW' },
    { pattern: /^([\d,]+(?:\.\d+)?)\s*원$/, currency: 'KRW' },
    { pattern: /^([\d,]+(?:\.\d+)?)\s*만원$/, currency: 'KRW_MAN' },
    // US Dollar
    { pattern: /^\$\s*([\d,]+(?:\.\d+)?)$/, currency: 'USD' },
    { pattern: /^USD\s*([\d,]+(?:\.\d+)?)$/i, currency: 'USD' },
    // Euro
    { pattern: /^€\s*([\d,]+(?:\.\d+)?)$/, currency: 'EUR' },
    { pattern: /^([\d,]+(?:\.\d+)?)\s*€$/, currency: 'EUR' },
    // Japanese Yen
    { pattern: /^¥\s*([\d,]+(?:\.\d+)?)$/, currency: 'JPY' },
    { pattern: /^([\d,]+(?:\.\d+)?)\s*円$/, currency: 'JPY' },
];

const MONTH_MAP: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

@Injectable()
export class NormalizerService {
    private readonly logger = new Logger(NormalizerService.name);

    /**
     * Normalize a range of data
     */
    normalizeRange(
        data: any[][],
        options: {
            normalizeDate?: boolean;
            normalizeCurrency?: boolean;
            normalizeNumbers?: boolean;
            normalizeText?: boolean;
            targetDateFormat?: string;
            targetCurrency?: string;
        } = {},
    ): NormalizationReport {
        const {
            normalizeDate = true,
            normalizeCurrency = true,
            normalizeNumbers = true,
            normalizeText = true,
            targetDateFormat = 'YYYY-MM-DD',
            targetCurrency = 'KRW',
        } = options;

        const report: NormalizationReport = {
            totalCells: 0,
            normalizedCells: 0,
            changes: [],
            detectedTypes: {},
        };

        for (let row = 0; row < data.length; row++) {
            for (let col = 0; col < data[row].length; col++) {
                const value = data[row][col];
                report.totalCells++;

                if (value == null || value === '') continue;

                const strValue = String(value).trim();

                // Try date normalization
                if (normalizeDate) {
                    const dateResult = this.normalizeDate(strValue, targetDateFormat);
                    if (dateResult.changed) {
                        data[row][col] = dateResult.normalizedValue;
                        report.normalizedCells++;
                        report.changes.push({
                            row, col,
                            original: dateResult.originalValue,
                            normalized: dateResult.normalizedValue,
                            type: 'date',
                        });
                        report.detectedTypes['date'] = (report.detectedTypes['date'] || 0) + 1;
                        continue;
                    }
                }

                // Try currency normalization
                if (normalizeCurrency) {
                    const currencyResult = this.normalizeCurrency(strValue, targetCurrency);
                    if (currencyResult.changed) {
                        data[row][col] = currencyResult.normalizedValue;
                        report.normalizedCells++;
                        report.changes.push({
                            row, col,
                            original: currencyResult.originalValue,
                            normalized: currencyResult.normalizedValue,
                            type: 'currency',
                        });
                        report.detectedTypes['currency'] = (report.detectedTypes['currency'] || 0) + 1;
                        continue;
                    }
                }

                // Try number normalization
                if (normalizeNumbers) {
                    const numberResult = this.normalizeNumber(strValue);
                    if (numberResult.changed) {
                        data[row][col] = numberResult.normalizedValue;
                        report.normalizedCells++;
                        report.changes.push({
                            row, col,
                            original: numberResult.originalValue,
                            normalized: numberResult.normalizedValue,
                            type: 'number',
                        });
                        report.detectedTypes['number'] = (report.detectedTypes['number'] || 0) + 1;
                        continue;
                    }
                }

                // Try text normalization (trim, case)
                if (normalizeText) {
                    const textResult = this.normalizeText(strValue);
                    if (textResult.changed) {
                        data[row][col] = textResult.normalizedValue;
                        report.normalizedCells++;
                        report.changes.push({
                            row, col,
                            original: textResult.originalValue,
                            normalized: textResult.normalizedValue,
                            type: 'text',
                        });
                        report.detectedTypes['text'] = (report.detectedTypes['text'] || 0) + 1;
                    }
                }
            }
        }

        return report;
    }

    /**
     * Normalize date value to target format
     */
    normalizeDate(value: string, targetFormat: string = 'YYYY-MM-DD'): NormalizationResult {
        for (const { pattern, format } of DATE_PATTERNS) {
            const match = value.match(pattern);
            if (match) {
                let year: number, month: number, day: number;

                if (format === 'YYYY년 MM월 DD일' || format === 'YYYY.MM.DD' || format === 'YYYY-MM-DD' || format === 'YYYY/MM/DD') {
                    year = parseInt(match[1]);
                    month = parseInt(match[2]);
                    day = parseInt(match[3]);
                } else if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
                    month = parseInt(match[1]);
                    day = parseInt(match[2]);
                    year = parseInt(match[3]);
                } else if (format === 'DD.MM.YYYY') {
                    day = parseInt(match[1]);
                    month = parseInt(match[2]);
                    year = parseInt(match[3]);
                } else if (format === 'Mon DD, YYYY') {
                    month = MONTH_MAP[match[1].toLowerCase()];
                    day = parseInt(match[2]);
                    year = parseInt(match[3]);
                } else if (format === 'DD Mon YYYY') {
                    day = parseInt(match[1]);
                    month = MONTH_MAP[match[2].toLowerCase()];
                    year = parseInt(match[3]);
                } else {
                    continue;
                }

                // Validate date
                if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                    continue;
                }

                const normalizedValue = this.formatDate(year, month, day, targetFormat);

                return {
                    originalValue: value,
                    normalizedValue,
                    type: 'date',
                    confidence: 0.95,
                    changed: normalizedValue !== value,
                };
            }
        }

        return {
            originalValue: value,
            normalizedValue: value,
            type: 'unknown',
            confidence: 0,
            changed: false,
        };
    }

    /**
     * Format date to target format
     */
    private formatDate(year: number, month: number, day: number, format: string): string {
        const pad = (n: number) => n.toString().padStart(2, '0');

        switch (format) {
            case 'YYYY-MM-DD':
                return `${year}-${pad(month)}-${pad(day)}`;
            case 'YYYY/MM/DD':
                return `${year}/${pad(month)}/${pad(day)}`;
            case 'YYYY.MM.DD':
                return `${year}.${pad(month)}.${pad(day)}`;
            case 'YYYY년 MM월 DD일':
                return `${year}년 ${pad(month)}월 ${pad(day)}일`;
            case 'MM/DD/YYYY':
                return `${pad(month)}/${pad(day)}/${year}`;
            case 'DD.MM.YYYY':
                return `${pad(day)}.${pad(month)}.${year}`;
            default:
                return `${year}-${pad(month)}-${pad(day)}`;
        }
    }

    /**
     * Normalize currency value
     */
    normalizeCurrency(value: string, targetCurrency: string = 'KRW'): NormalizationResult {
        for (const { pattern, currency } of CURRENCY_PATTERNS) {
            const match = value.match(pattern);
            if (match) {
                let numericValue = parseFloat(match[1].replace(/,/g, ''));

                // Handle 만원 (10,000 won)
                if (currency === 'KRW_MAN') {
                    numericValue *= 10000;
                }

                // Format according to target currency
                const normalizedValue = this.formatCurrency(numericValue, targetCurrency);

                return {
                    originalValue: value,
                    normalizedValue,
                    type: 'currency',
                    confidence: 0.9,
                    changed: normalizedValue !== value,
                };
            }
        }

        return {
            originalValue: value,
            normalizedValue: value,
            type: 'unknown',
            confidence: 0,
            changed: false,
        };
    }

    /**
     * Format currency value
     */
    private formatCurrency(value: number, currency: string): string {
        switch (currency) {
            case 'KRW':
                return `₩${value.toLocaleString('ko-KR')}`;
            case 'USD':
                return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'EUR':
                return `€${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            case 'JPY':
                return `¥${value.toLocaleString('ja-JP')}`;
            case 'NUMBER':
                return value.toString();
            default:
                return value.toLocaleString();
        }
    }

    /**
     * Normalize number value (remove extra formatting)
     */
    normalizeNumber(value: string): NormalizationResult {
        // Check if it looks like a number with formatting
        const numberPattern = /^[+-]?[\d,\s]+(?:\.\d+)?$/;
        if (numberPattern.test(value)) {
            const cleanValue = value.replace(/[,\s]/g, '');
            const numericValue = parseFloat(cleanValue);

            if (!isNaN(numericValue)) {
                return {
                    originalValue: value,
                    normalizedValue: numericValue,
                    type: 'number',
                    confidence: 0.85,
                    changed: value !== cleanValue,
                };
            }
        }

        return {
            originalValue: value,
            normalizedValue: value,
            type: 'unknown',
            confidence: 0,
            changed: false,
        };
    }

    /**
     * Normalize text value (trim whitespace, etc.)
     */
    normalizeText(value: string): NormalizationResult {
        const trimmed = value.trim();
        const normalized = trimmed.replace(/\s+/g, ' '); // Collapse multiple spaces

        return {
            originalValue: value,
            normalizedValue: normalized,
            type: 'text',
            confidence: 0.9,
            changed: normalized !== value,
        };
    }

    /**
     * Detect data type of a value
     */
    detectType(value: any): { type: string; confidence: number } {
        if (value == null || value === '') {
            return { type: 'empty', confidence: 1 };
        }

        if (typeof value === 'number') {
            return { type: 'number', confidence: 1 };
        }

        if (typeof value === 'boolean') {
            return { type: 'boolean', confidence: 1 };
        }

        const strValue = String(value).trim();

        // Check for date
        for (const { pattern } of DATE_PATTERNS) {
            if (pattern.test(strValue)) {
                return { type: 'date', confidence: 0.95 };
            }
        }

        // Check for currency
        for (const { pattern } of CURRENCY_PATTERNS) {
            if (pattern.test(strValue)) {
                return { type: 'currency', confidence: 0.9 };
            }
        }

        // Check for number
        if (/^[+-]?[\d,\s]+(?:\.\d+)?$/.test(strValue)) {
            return { type: 'number', confidence: 0.85 };
        }

        // Check for email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
            return { type: 'email', confidence: 0.95 };
        }

        // Check for phone number
        if (/^[\d\-\+\(\)\s]{10,}$/.test(strValue)) {
            return { type: 'phone', confidence: 0.8 };
        }

        return { type: 'text', confidence: 0.7 };
    }

    /**
     * Analyze column types in a range
     */
    analyzeColumnTypes(data: any[][]): { column: number; type: string; confidence: number }[] {
        if (data.length === 0) return [];

        const colCount = data[0].length;
        const result: { column: number; type: string; confidence: number }[] = [];

        for (let col = 0; col < colCount; col++) {
            const typeCounts: Record<string, number> = {};
            let totalNonEmpty = 0;

            for (let row = 0; row < data.length; row++) {
                const value = data[row][col];
                if (value == null || value === '') continue;

                totalNonEmpty++;
                const detected = this.detectType(value);
                typeCounts[detected.type] = (typeCounts[detected.type] || 0) + 1;
            }

            if (totalNonEmpty === 0) {
                result.push({ column: col, type: 'empty', confidence: 1 });
                continue;
            }

            // Find dominant type
            let maxType = 'text';
            let maxCount = 0;
            for (const [type, count] of Object.entries(typeCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    maxType = type;
                }
            }

            result.push({
                column: col,
                type: maxType,
                confidence: maxCount / totalNonEmpty,
            });
        }

        return result;
    }
}
