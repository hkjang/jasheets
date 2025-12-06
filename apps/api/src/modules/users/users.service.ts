import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isAdmin: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
          }
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isAdmin: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          }
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(dto: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        isAdmin: dto.isAdmin || false,
        roleId: dto.roleId,
      },
      include: {
        role: true
      }
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');
    const data: any = { ...dto };
    
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true
      }
    });
  }

  async remove(id: string) {
    // Check if user exists
    await this.findOne(id);
    
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
