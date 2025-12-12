import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetLock } from '@prisma/client';

export interface CreateSheetLockDto {
    sheetId: string;
    reason?: string;
    expiresAt?: Date;
}

export interface SheetLockStatus {
    isLocked: boolean;
    lock?: SheetLock;
    canEdit: boolean;
}

@Injectable()
export class SheetLockService {
    constructor(private readonly prisma: PrismaService) { }

    async lockSheet(userId: string, dto: CreateSheetLockDto): Promise<SheetLock> {
        // Check if sheet exists
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: dto.sheetId },
        });

        if (!sheet) {
            throw new NotFoundException(`Sheet with ID "${dto.sheetId}" not found`);
        }

        // Check if already locked
        const existingLock = await this.prisma.sheetLock.findUnique({
            where: { sheetId: dto.sheetId },
        });

        if (existingLock) {
            // Check if lock has expired
            if (existingLock.expiresAt && new Date() > existingLock.expiresAt) {
                // Delete expired lock and create new one
                await this.prisma.sheetLock.delete({
                    where: { id: existingLock.id },
                });
            } else {
                throw new ConflictException(`Sheet is already locked by user ${existingLock.lockedById}`);
            }
        }

        return this.prisma.sheetLock.create({
            data: {
                sheetId: dto.sheetId,
                lockedById: userId,
                reason: dto.reason,
                expiresAt: dto.expiresAt,
            },
        });
    }

    async unlockSheet(userId: string, sheetId: string, isAdmin: boolean = false): Promise<void> {
        const lock = await this.prisma.sheetLock.findUnique({
            where: { sheetId },
        });

        if (!lock) {
            throw new NotFoundException(`No lock found for sheet "${sheetId}"`);
        }

        // Only the user who locked it or an admin can unlock
        if (!isAdmin && lock.lockedById !== userId) {
            throw new ForbiddenException('Only the user who locked the sheet or an admin can unlock it');
        }

        await this.prisma.sheetLock.delete({
            where: { id: lock.id },
        });
    }

    async forceUnlock(sheetId: string): Promise<void> {
        const lock = await this.prisma.sheetLock.findUnique({
            where: { sheetId },
        });

        if (!lock) {
            throw new NotFoundException(`No lock found for sheet "${sheetId}"`);
        }

        await this.prisma.sheetLock.delete({
            where: { id: lock.id },
        });
    }

    async getLockStatus(sheetId: string, userId?: string): Promise<SheetLockStatus> {
        const lock = await this.prisma.sheetLock.findUnique({
            where: { sheetId },
        });

        if (!lock) {
            return { isLocked: false, canEdit: true };
        }

        // Check if lock has expired
        if (lock.expiresAt && new Date() > lock.expiresAt) {
            // Auto-remove expired lock
            await this.prisma.sheetLock.delete({
                where: { id: lock.id },
            });
            return { isLocked: false, canEdit: true };
        }

        return {
            isLocked: true,
            lock,
            canEdit: userId ? lock.lockedById === userId : false,
        };
    }

    async getAllLocks(): Promise<SheetLock[]> {
        return this.prisma.sheetLock.findMany({
            orderBy: { lockedAt: 'desc' },
        });
    }

    async getLocksWithDetails(): Promise<any[]> {
        const locks = await this.prisma.sheetLock.findMany({
            orderBy: { lockedAt: 'desc' },
        });

        // Enrich with sheet and user information
        const enrichedLocks = await Promise.all(
            locks.map(async (lock) => {
                const sheet = await this.prisma.sheet.findUnique({
                    where: { id: lock.sheetId },
                    include: { spreadsheet: { select: { name: true } } },
                });
                const user = await this.prisma.user.findUnique({
                    where: { id: lock.lockedById },
                    select: { email: true, name: true },
                });
                return {
                    ...lock,
                    sheet: sheet ? { id: sheet.id, name: sheet.name, spreadsheetName: sheet.spreadsheet?.name } : null,
                    lockedBy: user,
                };
            })
        );

        return enrichedLocks;
    }

    async cleanupExpiredLocks(): Promise<number> {
        const result = await this.prisma.sheetLock.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });
        return result.count;
    }
}
