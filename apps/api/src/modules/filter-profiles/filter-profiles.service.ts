import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFilterProfileDto, UpdateFilterProfileDto } from './dto/filter-profile.dto';

export interface FilterCondition {
    column: number;
    operator: string;
    value: any;
}

export interface SortingConfig {
    column: number;
    direction: 'asc' | 'desc';
}

@Injectable()
export class FilterProfilesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check sheet access
     */
    private async checkSheetAccess(userId: string, sheetId: string, requireEdit = false): Promise<void> {
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: {
                spreadsheet: {
                    include: {
                        permissions: { where: { userId } },
                    },
                },
            },
        });

        if (!sheet) {
            throw new NotFoundException('Sheet not found');
        }

        const isOwner = sheet.spreadsheet.ownerId === userId;
        const permission = sheet.spreadsheet.permissions[0];

        if (!isOwner && !permission && !sheet.spreadsheet.isPublic) {
            throw new ForbiddenException('No access to this sheet');
        }

        if (requireEdit && !isOwner && (!permission || !['OWNER', 'EDITOR'].includes(permission.role))) {
            throw new ForbiddenException('No edit access to this sheet');
        }
    }

    /**
     * Get all filter profiles for a sheet
     */
    async getProfiles(userId: string, sheetId: string) {
        await this.checkSheetAccess(userId, sheetId);

        return this.prisma.filterProfile.findMany({
            where: { sheetId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Get the default profile for a sheet
     */
    async getDefaultProfile(userId: string, sheetId: string) {
        await this.checkSheetAccess(userId, sheetId);

        return this.prisma.filterProfile.findFirst({
            where: { sheetId, isDefault: true },
        });
    }

    /**
     * Get a specific profile
     */
    async getProfile(userId: string, profileId: string) {
        const profile = await this.prisma.filterProfile.findUnique({
            where: { id: profileId },
        });

        if (!profile) {
            throw new NotFoundException('Filter profile not found');
        }

        await this.checkSheetAccess(userId, profile.sheetId);
        return profile;
    }

    /**
     * Create a new filter profile
     */
    async createProfile(userId: string, sheetId: string, dto: CreateFilterProfileDto) {
        await this.checkSheetAccess(userId, sheetId, true);

        // If setting as default, unset other defaults
        if (dto.isDefault) {
            await this.prisma.filterProfile.updateMany({
                where: { sheetId, isDefault: true },
                data: { isDefault: false },
            });
        }

        return this.prisma.filterProfile.create({
            data: {
                sheetId,
                name: dto.name,
                filters: dto.filters,
                sortings: dto.sortings,
                hiddenCols: dto.hiddenCols || [],
                hiddenRows: dto.hiddenRows || [],
                isDefault: dto.isDefault || false,
            },
        });
    }

    /**
     * Update a filter profile
     */
    async updateProfile(userId: string, profileId: string, dto: UpdateFilterProfileDto) {
        const profile = await this.getProfile(userId, profileId);
        await this.checkSheetAccess(userId, profile.sheetId, true);

        // If setting as default, unset other defaults
        if (dto.isDefault) {
            await this.prisma.filterProfile.updateMany({
                where: { sheetId: profile.sheetId, isDefault: true, id: { not: profileId } },
                data: { isDefault: false },
            });
        }

        return this.prisma.filterProfile.update({
            where: { id: profileId },
            data: {
                name: dto.name,
                filters: dto.filters,
                sortings: dto.sortings,
                hiddenCols: dto.hiddenCols,
                hiddenRows: dto.hiddenRows,
                isDefault: dto.isDefault,
            },
        });
    }

    /**
     * Delete a filter profile
     */
    async deleteProfile(userId: string, profileId: string) {
        const profile = await this.getProfile(userId, profileId);
        await this.checkSheetAccess(userId, profile.sheetId, true);

        await this.prisma.filterProfile.delete({
            where: { id: profileId },
        });

        return { success: true };
    }

    /**
     * Set a profile as default
     */
    async setDefaultProfile(userId: string, profileId: string) {
        const profile = await this.getProfile(userId, profileId);
        await this.checkSheetAccess(userId, profile.sheetId, true);

        // Unset other defaults
        await this.prisma.filterProfile.updateMany({
            where: { sheetId: profile.sheetId, isDefault: true },
            data: { isDefault: false },
        });

        return this.prisma.filterProfile.update({
            where: { id: profileId },
            data: { isDefault: true },
        });
    }

    /**
     * Apply filters to data
     */
    applyFilters(
        data: Array<Record<number, any>>,
        filters: FilterCondition[],
    ): Array<Record<number, any>> {
        return data.filter(row => {
            return filters.every(filter => this.evaluateFilter(row[filter.column], filter));
        });
    }

    /**
     * Evaluate a single filter condition
     */
    private evaluateFilter(value: any, filter: FilterCondition): boolean {
        const { operator, value: filterValue } = filter;

        switch (operator) {
            case 'equals':
                return value === filterValue;
            case 'notEquals':
                return value !== filterValue;
            case 'contains':
                return String(value ?? '').toLowerCase().includes(String(filterValue).toLowerCase());
            case 'notContains':
                return !String(value ?? '').toLowerCase().includes(String(filterValue).toLowerCase());
            case 'startsWith':
                return String(value ?? '').toLowerCase().startsWith(String(filterValue).toLowerCase());
            case 'endsWith':
                return String(value ?? '').toLowerCase().endsWith(String(filterValue).toLowerCase());
            case 'greaterThan':
                return Number(value) > Number(filterValue);
            case 'greaterThanOrEqual':
                return Number(value) >= Number(filterValue);
            case 'lessThan':
                return Number(value) < Number(filterValue);
            case 'lessThanOrEqual':
                return Number(value) <= Number(filterValue);
            case 'isEmpty':
                return value === null || value === undefined || value === '';
            case 'isNotEmpty':
                return value !== null && value !== undefined && value !== '';
            case 'between':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    return Number(value) >= Number(filterValue[0]) && Number(value) <= Number(filterValue[1]);
                }
                return false;
            default:
                return true;
        }
    }

    /**
     * Apply sorting to data
     */
    applySorting(
        data: Array<Record<number, any>>,
        sortings: SortingConfig[],
    ): Array<Record<number, any>> {
        return [...data].sort((a, b) => {
            for (const sorting of sortings) {
                const aVal = a[sorting.column];
                const bVal = b[sorting.column];

                let comparison = 0;
                if (aVal === null || aVal === undefined) comparison = 1;
                else if (bVal === null || bVal === undefined) comparison = -1;
                else if (typeof aVal === 'number' && typeof bVal === 'number') {
                    comparison = aVal - bVal;
                } else {
                    comparison = String(aVal).localeCompare(String(bVal));
                }

                if (comparison !== 0) {
                    return sorting.direction === 'desc' ? -comparison : comparison;
                }
            }
            return 0;
        });
    }

    /**
     * Apply a profile (filters + sorting) to sheet data
     */
    async applyProfile(
        userId: string,
        profileId: string,
        data: Array<Record<number, any>>,
    ): Promise<{ filteredData: Array<Record<number, any>>; hiddenCols: number[]; hiddenRows: number[] }> {
        const profile = await this.getProfile(userId, profileId);

        let result = data;

        // Apply filters
        const filters = profile.filters as unknown as FilterCondition[];
        if (filters && filters.length > 0) {
            result = this.applyFilters(result, filters);
        }

        // Apply sorting
        const sortings = profile.sortings as unknown as SortingConfig[];
        if (sortings && sortings.length > 0) {
            result = this.applySorting(result, sortings);
        }

        return {
            filteredData: result,
            hiddenCols: profile.hiddenCols || [],
            hiddenRows: profile.hiddenRows || [],
        };
    }
}
