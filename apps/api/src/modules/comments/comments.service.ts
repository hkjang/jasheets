import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionRole } from '@prisma/client';

interface CreateCommentDto {
  sheetId: string;
  row: number;
  col: number;
  content: string;
}

interface CreateReplyDto {
  content: string;
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertSheetAccess(
    userId: string,
    sheetId: string,
    requireCommentAccess = false,
  ): Promise<void> {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: {
        spreadsheet: {
          select: {
            ownerId: true,
            isPublic: true,
            deletedAt: true,
            permissions: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!sheet || sheet.spreadsheet.deletedAt) {
      throw new NotFoundException('Sheet not found');
    }

    const spreadsheet = sheet.spreadsheet;
    if (spreadsheet.ownerId === userId) return;
    const role = spreadsheet.permissions[0]?.role;
    const hasReadAccess = spreadsheet.isPublic || Boolean(role);
    const hasCommentAccess =
      role === PermissionRole.COMMENTER ||
      role === PermissionRole.EDITOR ||
      role === PermissionRole.OWNER;

    if (requireCommentAccess ? !hasCommentAccess : !hasReadAccess) {
      throw new ForbiddenException('You do not have access to this sheet');
    }
  }

  async createComment(userId: string, dto: CreateCommentDto) {
    await this.assertSheetAccess(userId, dto.sheetId, true);

    return this.prisma.comment.create({
      data: {
        sheetId: dto.sheetId,
        row: dto.row,
        col: dto.col,
        content: dto.content,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async getComments(userId: string, sheetId: string) {
    await this.assertSheetAccess(userId, sheetId);
    return this.prisma.comment.findMany({
      where: {
        sheetId,
        parentId: null, // Only top-level comments
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCommentsForCell(
    userId: string,
    sheetId: string,
    row: number,
    col: number,
  ) {
    await this.assertSheetAccess(userId, sheetId);
    return this.prisma.comment.findMany({
      where: {
        sheetId,
        row,
        col,
        parentId: null,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addReply(userId: string, commentId: string, dto: CreateReplyDto) {
    const parentComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }
    await this.assertSheetAccess(userId, parentComment.sheetId, true);

    return this.prisma.comment.create({
      data: {
        sheetId: parentComment.sheetId,
        row: parentComment.row,
        col: parentComment.col,
        content: dto.content,
        authorId: userId,
        parentId: commentId,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  async updateComment(userId: string, commentId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.assertSheetAccess(userId, comment.sheetId, true);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { sheet: { include: { spreadsheet: true } } },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Allow author or spreadsheet owner to delete
    if (
      comment.authorId !== userId &&
      comment.sheet.spreadsheet.ownerId !== userId
    ) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  async resolveComment(userId: string, commentId: string, resolved: boolean) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.assertSheetAccess(userId, comment.sheetId, true);

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }
}
