import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Notice, Prisma } from '@prisma/client';

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.NoticeCreateInput): Promise<Notice> {
    return this.prisma.notice.create({ data });
  }

  async findAll(onlyActive: boolean = false): Promise<Notice[]> {
    const where: Prisma.NoticeWhereInput = {};
    if (onlyActive) {
      where.active = true;
      where.OR = [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ];
    }
    return this.prisma.notice.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string): Promise<Notice> {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`Notice with ID ${id} not found`);
    }
    return notice;
  }

  async update(id: string, data: Prisma.NoticeUpdateInput): Promise<Notice> {
    await this.findOne(id); // Ensure exists
    return this.prisma.notice.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Notice> {
    await this.findOne(id); // Ensure exists
    return this.prisma.notice.delete({ where: { id } });
  }
}
