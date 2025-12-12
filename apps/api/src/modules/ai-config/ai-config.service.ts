import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIModelConfig, AIModelType, AIProvider, Prisma } from '@prisma/client';

export interface CreateAIConfigDto {
    name: string;
    modelType: AIModelType;
    provider: AIProvider;
    modelId: string;
    version: string;
    isActive?: boolean;
    isDefault?: boolean;
    config?: Record<string, any>;
}

export interface UpdateAIConfigDto {
    name?: string;
    modelId?: string;
    version?: string;
    isActive?: boolean;
    isDefault?: boolean;
    config?: Record<string, any>;
}

@Injectable()
export class AIConfigService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateAIConfigDto): Promise<AIModelConfig> {
        const existing = await this.prisma.aIModelConfig.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException(`AI config with name "${dto.name}" already exists`);
        }

        // If setting as default, unset other defaults of same type
        if (dto.isDefault) {
            await this.prisma.aIModelConfig.updateMany({
                where: { modelType: dto.modelType, isDefault: true },
                data: { isDefault: false },
            });
        }

        return this.prisma.aIModelConfig.create({
            data: {
                name: dto.name,
                modelType: dto.modelType,
                provider: dto.provider,
                modelId: dto.modelId,
                version: dto.version,
                isActive: dto.isActive ?? true,
                isDefault: dto.isDefault ?? false,
                config: dto.config as Prisma.InputJsonValue,
            },
        });
    }

    async findAll(): Promise<AIModelConfig[]> {
        return this.prisma.aIModelConfig.findMany({
            orderBy: [{ modelType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findByType(modelType: AIModelType): Promise<AIModelConfig[]> {
        return this.prisma.aIModelConfig.findMany({
            where: { modelType, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findDefault(modelType: AIModelType): Promise<AIModelConfig | null> {
        return this.prisma.aIModelConfig.findFirst({
            where: { modelType, isDefault: true, isActive: true },
        });
    }

    async findOne(id: string): Promise<AIModelConfig> {
        const config = await this.prisma.aIModelConfig.findUnique({
            where: { id },
        });

        if (!config) {
            throw new NotFoundException(`AI config with ID "${id}" not found`);
        }

        return config;
    }

    async update(id: string, dto: UpdateAIConfigDto): Promise<AIModelConfig> {
        const existing = await this.findOne(id);

        if (dto.name && dto.name !== existing.name) {
            const nameConflict = await this.prisma.aIModelConfig.findUnique({
                where: { name: dto.name },
            });
            if (nameConflict) {
                throw new ConflictException(`AI config with name "${dto.name}" already exists`);
            }
        }

        // If setting as default, unset other defaults of same type
        if (dto.isDefault) {
            await this.prisma.aIModelConfig.updateMany({
                where: { modelType: existing.modelType, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        return this.prisma.aIModelConfig.update({
            where: { id },
            data: {
                name: dto.name,
                modelId: dto.modelId,
                version: dto.version,
                isActive: dto.isActive,
                isDefault: dto.isDefault,
                config: dto.config as Prisma.InputJsonValue,
            },
        });
    }

    async delete(id: string): Promise<AIModelConfig> {
        await this.findOne(id);
        return this.prisma.aIModelConfig.delete({ where: { id } });
    }

    async getActiveConfig(modelType: AIModelType): Promise<AIModelConfig> {
        const defaultConfig = await this.findDefault(modelType);
        if (defaultConfig) return defaultConfig;

        const anyActive = await this.prisma.aIModelConfig.findFirst({
            where: { modelType, isActive: true },
        });

        if (!anyActive) {
            throw new NotFoundException(`No active AI config found for type "${modelType}"`);
        }

        return anyActive;
    }
}
