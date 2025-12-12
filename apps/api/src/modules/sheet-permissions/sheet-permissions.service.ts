import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSheetPermissionDto, UpdateSheetPermissionDto } from './dto/sheet-permission.dto';
import { SheetPermissionRole, PermissionRole } from '@prisma/client';

@Injectable()
export class SheetPermissionsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if user has access to the spreadsheet containing the sheet
     */
    private async checkSpreadsheetAccess(userId: string, sheetId: string): Promise<{ sheetId: string; spreadsheetId: string; isOwner: boolean }> {
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: {
                spreadsheet: {
                    include: {
                        permissions: {
                            where: { userId },
                        },
                    },
                },
            },
        });

        if (!sheet) {
            throw new NotFoundException('Sheet not found');
        }

        const spreadsheet = sheet.spreadsheet;
        const isOwner = spreadsheet.ownerId === userId;
        const permission = spreadsheet.permissions[0];

        if (!isOwner && !permission) {
            throw new ForbiddenException('No access to this spreadsheet');
        }

        return { sheetId, spreadsheetId: spreadsheet.id, isOwner };
    }

    /**
     * Get all permissions for a sheet
     */
    async getSheetPermissions(userId: string, sheetId: string) {
        await this.checkSpreadsheetAccess(userId, sheetId);

        return this.prisma.sheetPermission.findMany({
            where: { sheetId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Add a permission to a sheet
     */
    async addSheetPermission(userId: string, sheetId: string, dto: CreateSheetPermissionDto) {
        const { isOwner } = await this.checkSpreadsheetAccess(userId, sheetId);

        if (!isOwner) {
            // Only spreadsheet owner can manage sheet permissions
            const hasEditorAccess = await this.prisma.permission.findFirst({
                where: {
                    spreadsheet: { sheets: { some: { id: sheetId } } },
                    userId,
                    role: { in: [PermissionRole.OWNER, PermissionRole.EDITOR] },
                },
            });

            if (!hasEditorAccess) {
                throw new ForbiddenException('Only editors or owners can manage sheet permissions');
            }
        }

        if (!dto.userId && !dto.email) {
            throw new BadRequestException('Either userId or email must be provided');
        }

        // Check if permission already exists
        const existingPermission = await this.prisma.sheetPermission.findFirst({
            where: {
                sheetId,
                OR: [
                    dto.userId ? { userId: dto.userId } : {},
                    dto.email ? { email: dto.email } : {},
                ].filter(o => Object.keys(o).length > 0),
            },
        });

        if (existingPermission) {
            // Update existing permission
            return this.prisma.sheetPermission.update({
                where: { id: existingPermission.id },
                data: { role: dto.role },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            });
        }

        return this.prisma.sheetPermission.create({
            data: {
                sheetId,
                userId: dto.userId,
                email: dto.email,
                role: dto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    /**
     * Update a sheet permission
     */
    async updateSheetPermission(userId: string, permissionId: string, dto: UpdateSheetPermissionDto) {
        const permission = await this.prisma.sheetPermission.findUnique({
            where: { id: permissionId },
            include: { sheet: true },
        });

        if (!permission) {
            throw new NotFoundException('Permission not found');
        }

        await this.checkSpreadsheetAccess(userId, permission.sheetId);

        return this.prisma.sheetPermission.update({
            where: { id: permissionId },
            data: { role: dto.role },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    /**
     * Remove a sheet permission
     */
    async removeSheetPermission(userId: string, permissionId: string) {
        const permission = await this.prisma.sheetPermission.findUnique({
            where: { id: permissionId },
            include: { sheet: true },
        });

        if (!permission) {
            throw new NotFoundException('Permission not found');
        }

        await this.checkSpreadsheetAccess(userId, permission.sheetId);

        await this.prisma.sheetPermission.delete({
            where: { id: permissionId },
        });

        return { success: true };
    }

    /**
     * Check user's permission level for a specific sheet
     */
    async getSheetPermissionLevel(userId: string, sheetId: string): Promise<SheetPermissionRole | null> {
        // First check spreadsheet-level permission
        const sheet = await this.prisma.sheet.findUnique({
            where: { id: sheetId },
            include: {
                spreadsheet: {
                    include: {
                        permissions: {
                            where: { userId },
                        },
                    },
                },
                sheetPermissions: {
                    where: { userId },
                },
            },
        });

        if (!sheet) {
            return null;
        }

        // Owner has full access
        if (sheet.spreadsheet.ownerId === userId) {
            return SheetPermissionRole.EDITOR;
        }

        // Sheet-level permission takes precedence
        if (sheet.sheetPermissions[0]) {
            return sheet.sheetPermissions[0].role;
        }

        // Fall back to spreadsheet-level permission
        const spreadsheetPermission = sheet.spreadsheet.permissions[0];
        if (spreadsheetPermission) {
            // Map spreadsheet permission to sheet permission
            switch (spreadsheetPermission.role) {
                case PermissionRole.OWNER:
                case PermissionRole.EDITOR:
                    return SheetPermissionRole.EDITOR;
                case PermissionRole.COMMENTER:
                    return SheetPermissionRole.COMMENTER;
                case PermissionRole.VIEWER:
                    return SheetPermissionRole.VIEWER;
                default:
                    return SheetPermissionRole.VIEWER;
            }
        }

        // Public spreadsheet
        if (sheet.spreadsheet.isPublic) {
            return SheetPermissionRole.VIEWER;
        }

        return null;
    }

    /**
     * Check if user can edit the sheet
     */
    async canEditSheet(userId: string, sheetId: string): Promise<boolean> {
        const permissionLevel = await this.getSheetPermissionLevel(userId, sheetId);
        return permissionLevel === SheetPermissionRole.EDITOR;
    }

    /**
     * Check if user can comment on the sheet
     */
    async canCommentSheet(userId: string, sheetId: string): Promise<boolean> {
        const permissionLevel = await this.getSheetPermissionLevel(userId, sheetId);
        return permissionLevel === SheetPermissionRole.EDITOR || permissionLevel === SheetPermissionRole.COMMENTER;
    }
}
