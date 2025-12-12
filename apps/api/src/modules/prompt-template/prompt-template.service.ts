import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptTemplate, PromptCategory } from '@prisma/client';

export interface CreatePromptTemplateDto {
    name: string;
    category: PromptCategory;
    content: string;
    variables?: string[];
    description?: string;
    isDefault?: boolean;
}

export interface UpdatePromptTemplateDto {
    name?: string;
    content?: string;
    variables?: string[];
    description?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

@Injectable()
export class PromptTemplateService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreatePromptTemplateDto): Promise<PromptTemplate> {
        const existing = await this.prisma.promptTemplate.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException(`Prompt template with name "${dto.name}" already exists`);
        }

        // If setting as default, unset other defaults of same category
        if (dto.isDefault) {
            await this.prisma.promptTemplate.updateMany({
                where: { category: dto.category, isDefault: true },
                data: { isDefault: false },
            });
        }

        return this.prisma.promptTemplate.create({
            data: {
                name: dto.name,
                category: dto.category,
                content: dto.content,
                variables: dto.variables || [],
                description: dto.description,
                isDefault: dto.isDefault ?? false,
            },
        });
    }

    async findAll(): Promise<PromptTemplate[]> {
        return this.prisma.promptTemplate.findMany({
            orderBy: [{ category: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findByCategory(category: PromptCategory): Promise<PromptTemplate[]> {
        return this.prisma.promptTemplate.findMany({
            where: { category, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findDefault(category: PromptCategory): Promise<PromptTemplate | null> {
        return this.prisma.promptTemplate.findFirst({
            where: { category, isDefault: true, isActive: true },
        });
    }

    async findOne(id: string): Promise<PromptTemplate> {
        const template = await this.prisma.promptTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            throw new NotFoundException(`Prompt template with ID "${id}" not found`);
        }

        return template;
    }

    async update(id: string, dto: UpdatePromptTemplateDto): Promise<PromptTemplate> {
        const existing = await this.findOne(id);

        if (dto.name && dto.name !== existing.name) {
            const nameConflict = await this.prisma.promptTemplate.findUnique({
                where: { name: dto.name },
            });
            if (nameConflict) {
                throw new ConflictException(`Prompt template with name "${dto.name}" already exists`);
            }
        }

        // If setting as default, unset other defaults of same category
        if (dto.isDefault) {
            await this.prisma.promptTemplate.updateMany({
                where: { category: existing.category, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        return this.prisma.promptTemplate.update({
            where: { id },
            data: dto,
        });
    }

    async delete(id: string): Promise<PromptTemplate> {
        await this.findOne(id);
        return this.prisma.promptTemplate.delete({ where: { id } });
    }

    // Render template with variables
    renderTemplate(template: PromptTemplate, variables: Record<string, string>): string {
        let content = template.content;
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        return content;
    }
}
