import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionPolicy, Prisma } from '@prisma/client';

export interface PermissionRules {
    canEdit: boolean;
    canComment: boolean;
    canShare: boolean;
    canExport: boolean;
    canDelete: boolean;
    canViewHistory: boolean;
    canManageAutomation: boolean;
    canUseAI: boolean;
}

export interface CreatePermissionPolicyDto {
    name: string;
    description?: string;
    rules: PermissionRules;
    isDefault?: boolean;
}

export interface UpdatePermissionPolicyDto {
    name?: string;
    description?: string;
    rules?: Partial<PermissionRules>;
    isDefault?: boolean;
}

@Injectable()
export class PermissionPolicyService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreatePermissionPolicyDto): Promise<PermissionPolicy> {
        // Check if name already exists
        const existing = await this.prisma.permissionPolicy.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException(`Permission policy with name "${dto.name}" already exists`);
        }

        // If setting as default, unset other defaults
        if (dto.isDefault) {
            await this.prisma.permissionPolicy.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        return this.prisma.permissionPolicy.create({
            data: {
                name: dto.name,
                description: dto.description,
                rules: dto.rules as unknown as Prisma.InputJsonValue,
                isDefault: dto.isDefault || false,
            },
        });
    }

    async findAll(): Promise<PermissionPolicy[]> {
        return this.prisma.permissionPolicy.findMany({
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findOne(id: string): Promise<PermissionPolicy> {
        const policy = await this.prisma.permissionPolicy.findUnique({
            where: { id },
        });

        if (!policy) {
            throw new NotFoundException(`Permission policy with ID "${id}" not found`);
        }

        return policy;
    }

    async findByName(name: string): Promise<PermissionPolicy | null> {
        return this.prisma.permissionPolicy.findUnique({
            where: { name },
        });
    }

    async findDefault(): Promise<PermissionPolicy | null> {
        return this.prisma.permissionPolicy.findFirst({
            where: { isDefault: true },
        });
    }

    async update(id: string, dto: UpdatePermissionPolicyDto): Promise<PermissionPolicy> {
        const existing = await this.findOne(id);

        // Check name conflict if updating name
        if (dto.name && dto.name !== existing.name) {
            const nameConflict = await this.prisma.permissionPolicy.findUnique({
                where: { name: dto.name },
            });
            if (nameConflict) {
                throw new ConflictException(`Permission policy with name "${dto.name}" already exists`);
            }
        }

        // If setting as default, unset other defaults
        if (dto.isDefault) {
            await this.prisma.permissionPolicy.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const updateData: Prisma.PermissionPolicyUpdateInput = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.description !== undefined) updateData.description = dto.description;
        if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;
        if (dto.rules !== undefined) {
            // Merge with existing rules
            const currentRules = existing.rules as unknown as PermissionRules;
            updateData.rules = { ...currentRules, ...dto.rules } as unknown as Prisma.InputJsonValue;
        }

        return this.prisma.permissionPolicy.update({
            where: { id },
            data: updateData,
        });
    }

    async delete(id: string): Promise<PermissionPolicy> {
        await this.findOne(id); // Ensure exists

        return this.prisma.permissionPolicy.delete({
            where: { id },
        });
    }

    // Apply policy to check permissions
    checkPermission(policy: PermissionPolicy, action: keyof PermissionRules): boolean {
        const rules = policy.rules as unknown as PermissionRules;
        return rules[action] ?? false;
    }

    // Get default permission rules
    getDefaultRules(): PermissionRules {
        return {
            canEdit: true,
            canComment: true,
            canShare: false,
            canExport: true,
            canDelete: false,
            canViewHistory: true,
            canManageAutomation: false,
            canUseAI: true,
        };
    }
}
