import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Quota, QuotaTargetType } from '@prisma/client';

export interface CreateQuotaDto {
    targetType: QuotaTargetType;
    targetId: string;
    maxRows?: number;
    maxColumns?: number;
    maxCells?: number;
    maxFileSize?: number;
}

export interface UpdateQuotaDto {
    maxRows?: number;
    maxColumns?: number;
    maxCells?: number;
    maxFileSize?: number;
}

export interface QuotaUsage {
    quota: Quota;
    rowsUsagePercent: number;
    columnsUsagePercent: number;
    cellsUsagePercent: number;
    isExceeded: boolean;
}

@Injectable()
export class QuotaService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateQuotaDto): Promise<Quota> {
        return this.prisma.quota.create({
            data: {
                targetType: dto.targetType,
                targetId: dto.targetId,
                maxRows: dto.maxRows ?? 100000,
                maxColumns: dto.maxColumns ?? 1000,
                maxCells: dto.maxCells ?? 10000000,
                maxFileSize: dto.maxFileSize ?? 104857600,
            },
        });
    }

    async findOrCreate(targetType: QuotaTargetType, targetId: string): Promise<Quota> {
        let quota = await this.prisma.quota.findUnique({
            where: { targetType_targetId: { targetType, targetId } },
        });

        if (!quota) {
            quota = await this.create({ targetType, targetId });
        }

        return quota;
    }

    async findAll(): Promise<Quota[]> {
        return this.prisma.quota.findMany({
            orderBy: [{ targetType: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async findByType(targetType: QuotaTargetType): Promise<Quota[]> {
        return this.prisma.quota.findMany({
            where: { targetType },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string): Promise<Quota> {
        const quota = await this.prisma.quota.findUnique({
            where: { id },
        });

        if (!quota) {
            throw new NotFoundException(`Quota with ID "${id}" not found`);
        }

        return quota;
    }

    async update(id: string, dto: UpdateQuotaDto): Promise<Quota> {
        await this.findOne(id);
        return this.prisma.quota.update({
            where: { id },
            data: dto,
        });
    }

    async updateUsage(targetType: QuotaTargetType, targetId: string, usage: { rows?: number; columns?: number; cells?: number }): Promise<Quota> {
        const quota = await this.findOrCreate(targetType, targetId);

        return this.prisma.quota.update({
            where: { id: quota.id },
            data: {
                usedRows: usage.rows ?? quota.usedRows,
                usedColumns: usage.columns ?? quota.usedColumns,
                usedCells: usage.cells ?? quota.usedCells,
            },
        });
    }

    async delete(id: string): Promise<Quota> {
        await this.findOne(id);
        return this.prisma.quota.delete({ where: { id } });
    }

    async checkQuota(targetType: QuotaTargetType, targetId: string): Promise<QuotaUsage> {
        const quota = await this.findOrCreate(targetType, targetId);

        const rowsUsagePercent = (quota.usedRows / quota.maxRows) * 100;
        const columnsUsagePercent = (quota.usedColumns / quota.maxColumns) * 100;
        const cellsUsagePercent = (quota.usedCells / quota.maxCells) * 100;
        const isExceeded = rowsUsagePercent >= 100 || columnsUsagePercent >= 100 || cellsUsagePercent >= 100;

        return {
            quota,
            rowsUsagePercent,
            columnsUsagePercent,
            cellsUsagePercent,
            isExceeded,
        };
    }

    async validateOperation(targetType: QuotaTargetType, targetId: string, additionalRows: number = 0, additionalColumns: number = 0, additionalCells: number = 0): Promise<void> {
        const quota = await this.findOrCreate(targetType, targetId);

        if (quota.usedRows + additionalRows > quota.maxRows) {
            throw new BadRequestException(`Row limit exceeded. Max: ${quota.maxRows}, Current: ${quota.usedRows}, Requested: ${additionalRows}`);
        }
        if (quota.usedColumns + additionalColumns > quota.maxColumns) {
            throw new BadRequestException(`Column limit exceeded. Max: ${quota.maxColumns}, Current: ${quota.usedColumns}, Requested: ${additionalColumns}`);
        }
        if (quota.usedCells + additionalCells > quota.maxCells) {
            throw new BadRequestException(`Cell limit exceeded. Max: ${quota.maxCells}, Current: ${quota.usedCells}, Requested: ${additionalCells}`);
        }
    }

    async getDefaultLimits(): Promise<{ maxRows: number; maxColumns: number; maxCells: number; maxFileSize: number }> {
        return {
            maxRows: 100000,
            maxColumns: 1000,
            maxCells: 10000000,
            maxFileSize: 104857600,
        };
    }
}
