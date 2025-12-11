import { Injectable, Logger } from '@nestjs/common';

// Profile Types
export interface ColumnProfile {
    columnIndex: number;
    columnName?: string;
    dataType: 'numeric' | 'text' | 'date' | 'boolean' | 'mixed' | 'empty';
    statistics: ColumnStatistics;
    distribution: DistributionInfo;
    outliers: OutlierInfo[];
    quality: QualityMetrics;
}

export interface ColumnStatistics {
    count: number;
    nonEmpty: number;
    unique: number;
    missing: number;
    missingPercent: number;
    // Numeric stats
    min?: number;
    max?: number;
    sum?: number;
    mean?: number;
    median?: number;
    mode?: number | string;
    stdDev?: number;
    variance?: number;
    skewness?: number;
    // Text stats
    minLength?: number;
    maxLength?: number;
    avgLength?: number;
}

export interface DistributionInfo {
    type: 'uniform' | 'normal' | 'skewed_left' | 'skewed_right' | 'bimodal' | 'unknown';
    bins?: { range: string; count: number; percent: number }[];
    topValues?: { value: any; count: number; percent: number }[];
}

export interface OutlierInfo {
    rowIndex: number;
    value: any;
    zscore?: number;
    reason: string;
}

export interface QualityMetrics {
    completeness: number; // 0-100
    uniqueness: number; // 0-100
    validity: number; // 0-100
    consistency: number; // 0-100
    overallScore: number; // 0-100
    issues: string[];
}

export interface SheetProfile {
    sheetName: string;
    totalRows: number;
    totalCols: number;
    columns: ColumnProfile[];
    correlations?: CorrelationInfo[];
    summary: ProfileSummary;
    generatedAt: Date;
}

export interface CorrelationInfo {
    column1: number;
    column2: number;
    coefficient: number;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
}

export interface ProfileSummary {
    overallQuality: number;
    totalMissing: number;
    totalOutliers: number;
    insights: string[];
    recommendations: string[];
}

@Injectable()
export class ProfilerService {
    private readonly logger = new Logger(ProfilerService.name);

    /**
     * Profile a complete sheet/range
     */
    async profileSheet(
        data: any[][],
        options: {
            sheetName?: string;
            headers?: string[];
            detectOutliers?: boolean;
            calculateCorrelations?: boolean;
        } = {},
    ): Promise<SheetProfile> {
        const {
            sheetName = 'Sheet',
            headers,
            detectOutliers = true,
            calculateCorrelations = true,
        } = options;

        const totalRows = data.length;
        const totalCols = data[0]?.length || 0;
        const columns: ColumnProfile[] = [];

        // Profile each column
        for (let col = 0; col < totalCols; col++) {
            const columnData = data.map(row => row[col]);
            const columnName = headers?.[col] || this.colToLetter(col);
            const profile = this.profileColumn(columnData, col, columnName, detectOutliers);
            columns.push(profile);
        }

        // Calculate correlations for numeric columns
        let correlations: CorrelationInfo[] | undefined;
        if (calculateCorrelations) {
            correlations = this.calculateCorrelations(data, columns);
        }

        // Generate summary
        const summary = this.generateSummary(columns, correlations);

        return {
            sheetName,
            totalRows,
            totalCols,
            columns,
            correlations,
            summary,
            generatedAt: new Date(),
        };
    }

    /**
     * Profile a single column
     */
    profileColumn(
        data: any[],
        columnIndex: number,
        columnName: string,
        detectOutliers: boolean = true,
    ): ColumnProfile {
        const nonEmptyData = data.filter(v => v != null && v !== '');
        const dataType = this.detectDataType(nonEmptyData);
        const statistics = this.calculateStatistics(nonEmptyData, dataType);
        const distribution = this.analyzeDistribution(nonEmptyData, dataType);
        const outliers = detectOutliers ? this.detectOutliers(data, dataType, statistics) : [];
        const quality = this.assessQuality(data, statistics, outliers);

        return {
            columnIndex,
            columnName,
            dataType,
            statistics,
            distribution,
            outliers,
            quality,
        };
    }

    /**
     * Detect the predominant data type in a column
     */
    private detectDataType(data: any[]): 'numeric' | 'text' | 'date' | 'boolean' | 'mixed' | 'empty' {
        if (data.length === 0) return 'empty';

        const typeCounts = { numeric: 0, text: 0, date: 0, boolean: 0 };

        for (const value of data) {
            if (typeof value === 'number' || (!isNaN(Number(value)) && value !== '')) {
                typeCounts.numeric++;
            } else if (typeof value === 'boolean') {
                typeCounts.boolean++;
            } else if (this.isDateLike(value)) {
                typeCounts.date++;
            } else {
                typeCounts.text++;
            }
        }

        const total = data.length;
        const threshold = 0.8; // 80% of values should be of same type

        if (typeCounts.numeric / total >= threshold) return 'numeric';
        if (typeCounts.text / total >= threshold) return 'text';
        if (typeCounts.date / total >= threshold) return 'date';
        if (typeCounts.boolean / total >= threshold) return 'boolean';

        return 'mixed';
    }

    /**
     * Check if a value looks like a date
     */
    private isDateLike(value: any): boolean {
        if (value instanceof Date) return true;
        if (typeof value !== 'string') return false;

        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{4}\/\d{2}\/\d{2}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,
        ];

        return datePatterns.some(p => p.test(value));
    }

    /**
     * Calculate statistics for a column
     */
    private calculateStatistics(data: any[], dataType: string): ColumnStatistics {
        const count = data.length;
        const nonEmpty = data.filter(v => v != null && v !== '').length;
        const missing = count - nonEmpty;
        const unique = new Set(data.map(String)).size;

        const baseStats: ColumnStatistics = {
            count,
            nonEmpty,
            unique,
            missing,
            missingPercent: count > 0 ? (missing / count) * 100 : 0,
        };

        if (dataType === 'numeric') {
            const numbers = data
                .filter(v => v != null && typeof v === 'number' || !isNaN(Number(v)))
                .map(Number);

            if (numbers.length > 0) {
                const sorted = [...numbers].sort((a, b) => a - b);
                const sum = numbers.reduce((a, b) => a + b, 0);
                const mean = sum / numbers.length;

                // Calculate variance and std dev
                const squaredDiffs = numbers.map(v => Math.pow(v - mean, 2));
                const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
                const stdDev = Math.sqrt(variance);

                // Calculate median
                const mid = Math.floor(sorted.length / 2);
                const median = sorted.length % 2 === 0
                    ? (sorted[mid - 1] + sorted[mid]) / 2
                    : sorted[mid];

                // Calculate mode
                const frequency: Record<number, number> = {};
                numbers.forEach(n => { frequency[n] = (frequency[n] || 0) + 1; });
                let mode = numbers[0];
                let maxFreq = 0;
                for (const [val, freq] of Object.entries(frequency)) {
                    if (freq > maxFreq) {
                        maxFreq = freq;
                        mode = Number(val);
                    }
                }

                // Calculate skewness
                const skewness = stdDev > 0
                    ? (numbers.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 3), 0) / numbers.length)
                    : 0;

                Object.assign(baseStats, {
                    min: sorted[0],
                    max: sorted[sorted.length - 1],
                    sum,
                    mean,
                    median,
                    mode,
                    stdDev,
                    variance,
                    skewness,
                });
            }
        } else if (dataType === 'text') {
            const lengths = data.filter(v => typeof v === 'string').map(v => (v as string).length);
            if (lengths.length > 0) {
                Object.assign(baseStats, {
                    minLength: Math.min(...lengths),
                    maxLength: Math.max(...lengths),
                    avgLength: lengths.reduce((a, b) => a + b, 0) / lengths.length,
                });
            }
        }

        return baseStats;
    }

    /**
     * Analyze distribution of values
     */
    private analyzeDistribution(data: any[], dataType: string): DistributionInfo {
        if (data.length === 0) {
            return { type: 'unknown' };
        }

        // Calculate top values
        const valueCounts: Record<string, number> = {};
        data.forEach(v => {
            const key = String(v);
            valueCounts[key] = (valueCounts[key] || 0) + 1;
        });

        const topValues = Object.entries(valueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([value, count]) => ({
                value,
                count,
                percent: (count / data.length) * 100,
            }));

        if (dataType === 'numeric') {
            const numbers = data.map(Number).filter(n => !isNaN(n));
            if (numbers.length > 0) {
                const bins = this.createHistogramBins(numbers, 10);
                const skewness = this.calculateStatistics(data, dataType).skewness || 0;

                let type: DistributionInfo['type'] = 'unknown';
                if (Math.abs(skewness) < 0.5) {
                    type = 'normal';
                } else if (skewness > 0.5) {
                    type = 'skewed_right';
                } else if (skewness < -0.5) {
                    type = 'skewed_left';
                }

                return { type, bins, topValues };
            }
        }

        return { type: 'unknown', topValues };
    }

    /**
     * Create histogram bins for numeric data
     */
    private createHistogramBins(numbers: number[], binCount: number): DistributionInfo['bins'] {
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const binWidth = (max - min) / binCount || 1;
        const bins: { range: string; count: number; percent: number }[] = [];

        for (let i = 0; i < binCount; i++) {
            const start = min + i * binWidth;
            const end = start + binWidth;
            const count = numbers.filter(n => n >= start && (i === binCount - 1 ? n <= end : n < end)).length;
            bins.push({
                range: `${start.toFixed(2)} - ${end.toFixed(2)}`,
                count,
                percent: (count / numbers.length) * 100,
            });
        }

        return bins;
    }

    /**
     * Detect outliers using IQR or Z-score method
     */
    private detectOutliers(data: any[], dataType: string, statistics: ColumnStatistics): OutlierInfo[] {
        if (dataType !== 'numeric' || !statistics.stdDev || statistics.stdDev === 0) {
            return [];
        }

        const outliers: OutlierInfo[] = [];
        const mean = statistics.mean || 0;
        const stdDev = statistics.stdDev;
        const threshold = 3; // Z-score threshold

        data.forEach((value, index) => {
            if (typeof value === 'number' || !isNaN(Number(value))) {
                const numValue = Number(value);
                const zscore = Math.abs((numValue - mean) / stdDev);

                if (zscore > threshold) {
                    outliers.push({
                        rowIndex: index,
                        value: numValue,
                        zscore,
                        reason: `Z-score ${zscore.toFixed(2)} > ${threshold}`,
                    });
                }
            }
        });

        return outliers;
    }

    /**
     * Assess data quality for a column
     */
    private assessQuality(data: any[], statistics: ColumnStatistics, outliers: OutlierInfo[]): QualityMetrics {
        const issues: string[] = [];

        // Completeness: % of non-empty values
        const completeness = statistics.count > 0
            ? ((statistics.count - statistics.missing) / statistics.count) * 100
            : 0;
        if (statistics.missingPercent > 10) {
            issues.push(`결측치가 ${statistics.missingPercent.toFixed(1)}% 있습니다.`);
        }

        // Uniqueness: ratio of unique to total
        const uniqueness = statistics.nonEmpty > 0
            ? (statistics.unique / statistics.nonEmpty) * 100
            : 0;
        if (uniqueness < 10 && statistics.nonEmpty > 10) {
            issues.push('고유값 비율이 낮습니다. 중복 데이터가 많을 수 있습니다.');
        }

        // Validity: based on outliers and type consistency
        const outlierRatio = data.length > 0 ? (outliers.length / data.length) * 100 : 0;
        const validity = 100 - outlierRatio * 10;
        if (outliers.length > 0) {
            issues.push(`${outliers.length}개의 이상값이 감지되었습니다.`);
        }

        // Consistency: simplified check
        const consistency = 100 - (statistics.missingPercent / 2);

        // Overall score
        const overallScore = (completeness + uniqueness + validity + consistency) / 4;

        return {
            completeness,
            uniqueness,
            validity,
            consistency,
            overallScore,
            issues,
        };
    }

    /**
     * Calculate correlations between numeric columns
     */
    private calculateCorrelations(data: any[][], columns: ColumnProfile[]): CorrelationInfo[] {
        const numericCols = columns.filter(c => c.dataType === 'numeric');
        const correlations: CorrelationInfo[] = [];

        for (let i = 0; i < numericCols.length; i++) {
            for (let j = i + 1; j < numericCols.length; j++) {
                const col1 = numericCols[i].columnIndex;
                const col2 = numericCols[j].columnIndex;

                const values1 = data.map(row => Number(row[col1])).filter(v => !isNaN(v));
                const values2 = data.map(row => Number(row[col2])).filter(v => !isNaN(v));

                if (values1.length > 2 && values1.length === values2.length) {
                    const coefficient = this.pearsonCorrelation(values1, values2);
                    const absCoef = Math.abs(coefficient);

                    let strength: 'strong' | 'moderate' | 'weak' | 'none';
                    if (absCoef >= 0.7) strength = 'strong';
                    else if (absCoef >= 0.4) strength = 'moderate';
                    else if (absCoef >= 0.2) strength = 'weak';
                    else strength = 'none';

                    correlations.push({ column1: col1, column2: col2, coefficient, strength });
                }
            }
        }

        return correlations;
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    private pearsonCorrelation(x: number[], y: number[]): number {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
        const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Generate summary and insights
     */
    private generateSummary(columns: ColumnProfile[], correlations?: CorrelationInfo[]): ProfileSummary {
        const insights: string[] = [];
        const recommendations: string[] = [];

        let totalMissing = 0;
        let totalOutliers = 0;
        let qualitySum = 0;

        for (const col of columns) {
            totalMissing += col.statistics.missing;
            totalOutliers += col.outliers.length;
            qualitySum += col.quality.overallScore;

            if (col.statistics.missingPercent > 20) {
                recommendations.push(`${col.columnName}: 결측치가 많습니다. 데이터 수집 프로세스를 검토하세요.`);
            }

            if (col.dataType === 'mixed') {
                recommendations.push(`${col.columnName}: 데이터 타입이 혼합되어 있습니다. 정규화를 고려하세요.`);
            }
        }

        // Generate insights
        insights.push(`총 ${columns.length}개의 컬럼을 분석했습니다.`);

        const numericCols = columns.filter(c => c.dataType === 'numeric');
        const textCols = columns.filter(c => c.dataType === 'text');
        insights.push(`숫자형 ${numericCols.length}개, 텍스트형 ${textCols.length}개 컬럼이 있습니다.`);

        if (totalMissing > 0) {
            insights.push(`총 ${totalMissing}개의 결측치가 있습니다.`);
        }

        if (totalOutliers > 0) {
            insights.push(`총 ${totalOutliers}개의 이상값이 감지되었습니다.`);
        }

        // Add correlation insights
        if (correlations && correlations.length > 0) {
            const strongCorrelations = correlations.filter(c => c.strength === 'strong');
            if (strongCorrelations.length > 0) {
                insights.push(`${strongCorrelations.length}쌍의 강한 상관관계가 발견되었습니다.`);
            }
        }

        const overallQuality = columns.length > 0 ? qualitySum / columns.length : 0;

        return {
            overallQuality,
            totalMissing,
            totalOutliers,
            insights,
            recommendations,
        };
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
