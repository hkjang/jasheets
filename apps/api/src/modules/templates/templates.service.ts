import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Template, Prisma } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.TemplateCreateInput): Promise<Template> {
    return this.prisma.template.create({ data });
  }

  async findAll(category?: string): Promise<Template[]> {
    const where: Prisma.TemplateWhereInput = {};
    if (category) {
      where.category = category;
    }
    return this.prisma.template.findMany({
      where,
      orderBy: { order: 'asc' }
    });
  }

  async findOne(id: string): Promise<Template> {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  async update(id: string, data: Prisma.TemplateUpdateInput): Promise<Template> {
    await this.findOne(id);
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Template> {
    await this.findOne(id);
    return this.prisma.template.delete({ where: { id } });
  }
}
