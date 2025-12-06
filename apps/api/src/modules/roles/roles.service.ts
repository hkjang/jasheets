import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  async create(userId: string, data: Prisma.RoleCreateInput): Promise<Role> {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new BadRequestException(`Role with name ${data.name} already exists`);
    }
    const role = await this.prisma.role.create({ data });
    await this.auditService.log(userId, 'ROLE_CREATED', `Role: ${role.name}`, role);
    return role;
  }

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async update(userId: string, id: string, data: Prisma.RoleUpdateInput): Promise<Role> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    // Prevent updating system roles roughly
    if (role.isSystem && data.name && data.name !== role.name) {
       throw new BadRequestException('Cannot rename system roles');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
    });
    await this.auditService.log(userId, 'ROLE_UPDATED', `Role: ${updated.name}`, { prev: role, new: updated });
    return updated;
  }

  async remove(userId: string, id: string): Promise<Role> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }
    
    // Check if users are assigned
    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }

    const deleted = await this.prisma.role.delete({ where: { id } });
    await this.auditService.log(userId, 'ROLE_DELETED', `Role: ${deleted.name}`, deleted);
    return deleted;
  }
}
