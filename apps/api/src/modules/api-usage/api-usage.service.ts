import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { APIUsage } from '@prisma/client';

export interface RecordUsageDto {
    spreadsheetId?: string;
    userId?: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    requestSize?: number;
    responseSize?: number;
    userAgent?: string;
    ipAddress?: string;
}

export interface UsageStats {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    topEndpoints: { endpoint: string; count: number }[];
    errorsByEndpoint: { endpoint: string; count: number }[];
}

export interface TimeSeriesData {
    timestamp: Date;
    count: number;
    avgResponseTime: number;
}

@Injectable()
export class APIUsageService {
    constructor(private readonly prisma: PrismaService) { }

    async record(dto: RecordUsageDto): Promise<APIUsage> {
        return this.prisma.aPIUsage.create({
            data: dto,
        });
    }

    async getUsageBySpreadsheet(spreadsheetId: string, startDate?: Date, endDate?: Date): Promise<APIUsage[]> {
        return this.prisma.aPIUsage.findMany({
            where: {
                spreadsheetId,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { timestamp: 'desc' },
            take: 1000,
        });
    }

    async getUsageByUser(userId: string, startDate?: Date, endDate?: Date): Promise<APIUsage[]> {
        return this.prisma.aPIUsage.findMany({
            where: {
                userId,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { timestamp: 'desc' },
            take: 1000,
        });
    }

    async getStats(startDate?: Date, endDate?: Date): Promise<UsageStats> {
        const now = new Date();
        const defaultStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

        const where = {
            timestamp: {
                gte: startDate || defaultStartDate,
                lte: endDate || now,
            },
        };

        const [totalRequests, successfulRequests, allUsage] = await Promise.all([
            this.prisma.aPIUsage.count({ where }),
            this.prisma.aPIUsage.count({
                where: {
                    ...where,
                    statusCode: { lt: 400 },
                },
            }),
            this.prisma.aPIUsage.findMany({
                where,
                select: {
                    endpoint: true,
                    statusCode: true,
                    responseTimeMs: true,
                },
            }),
        ]);

        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
        const avgResponseTime = allUsage.length > 0
            ? allUsage.reduce((sum, u) => sum + u.responseTimeMs, 0) / allUsage.length
            : 0;

        // Calculate top endpoints
        const endpointCounts = new Map<string, number>();
        const errorCounts = new Map<string, number>();

        for (const usage of allUsage) {
            endpointCounts.set(usage.endpoint, (endpointCounts.get(usage.endpoint) || 0) + 1);
            if (usage.statusCode >= 400) {
                errorCounts.set(usage.endpoint, (errorCounts.get(usage.endpoint) || 0) + 1);
            }
        }

        const topEndpoints = Array.from(endpointCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([endpoint, count]) => ({ endpoint, count }));

        const errorsByEndpoint = Array.from(errorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([endpoint, count]) => ({ endpoint, count }));

        return {
            totalRequests,
            successRate,
            avgResponseTime,
            topEndpoints,
            errorsByEndpoint,
        };
    }

    async getSpreadsheetStats(spreadsheetId: string, days: number = 7): Promise<UsageStats> {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const where = {
            spreadsheetId,
            timestamp: { gte: startDate },
        };

        const [totalRequests, successfulRequests, allUsage] = await Promise.all([
            this.prisma.aPIUsage.count({ where }),
            this.prisma.aPIUsage.count({
                where: {
                    ...where,
                    statusCode: { lt: 400 },
                },
            }),
            this.prisma.aPIUsage.findMany({
                where,
                select: {
                    endpoint: true,
                    statusCode: true,
                    responseTimeMs: true,
                },
            }),
        ]);

        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
        const avgResponseTime = allUsage.length > 0
            ? allUsage.reduce((sum, u) => sum + u.responseTimeMs, 0) / allUsage.length
            : 0;

        const endpointCounts = new Map<string, number>();
        const errorCounts = new Map<string, number>();

        for (const usage of allUsage) {
            endpointCounts.set(usage.endpoint, (endpointCounts.get(usage.endpoint) || 0) + 1);
            if (usage.statusCode >= 400) {
                errorCounts.set(usage.endpoint, (errorCounts.get(usage.endpoint) || 0) + 1);
            }
        }

        return {
            totalRequests,
            successRate,
            avgResponseTime,
            topEndpoints: Array.from(endpointCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([endpoint, count]) => ({ endpoint, count })),
            errorsByEndpoint: Array.from(errorCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([endpoint, count]) => ({ endpoint, count })),
        };
    }

    async getTimeSeriesData(hours: number = 24, intervalMinutes: number = 60): Promise<TimeSeriesData[]> {
        const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        const usage = await this.prisma.aPIUsage.findMany({
            where: {
                timestamp: { gte: startDate },
            },
            select: {
                timestamp: true,
                responseTimeMs: true,
            },
            orderBy: { timestamp: 'asc' },
        });

        // Group by interval
        const buckets = new Map<number, { count: number; totalResponseTime: number }>();
        const intervalMs = intervalMinutes * 60 * 1000;

        for (const u of usage) {
            const bucketTime = Math.floor(u.timestamp.getTime() / intervalMs) * intervalMs;
            const bucket = buckets.get(bucketTime) || { count: 0, totalResponseTime: 0 };
            bucket.count++;
            bucket.totalResponseTime += u.responseTimeMs;
            buckets.set(bucketTime, bucket);
        }

        return Array.from(buckets.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([timestamp, data]) => ({
                timestamp: new Date(timestamp),
                count: data.count,
                avgResponseTime: data.totalResponseTime / data.count,
            }));
    }

    async cleanup(retentionDays: number = 30): Promise<number> {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        const result = await this.prisma.aPIUsage.deleteMany({
            where: {
                timestamp: { lt: cutoffDate },
            },
        });

        return result.count;
    }
}
