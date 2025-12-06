import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string | null, action: string, resource: string, details?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          details: details || {},
          ipAddress: '127.0.0.1', // Simplified for now
          userAgent: 'System', // Simplified
        },
      });
    } catch (e) {
      console.error('Failed to create audit log', e);
    }
  }

  async findAll() {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100
    });
  }
}
