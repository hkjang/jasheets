import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  createComment(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { sheetId: string; row: number; col: number; content: string },
  ) {
    return this.commentsService.createComment(req.user.id, dto);
  }

  @Get('sheet/:sheetId')
  getComments(
    @Request() req: AuthenticatedRequest,
    @Param('sheetId') sheetId: string,
  ) {
    return this.commentsService.getComments(req.user.id, sheetId);
  }

  @Get('sheet/:sheetId/cell/:row/:col')
  getCommentsForCell(
    @Request() req: AuthenticatedRequest,
    @Param('sheetId') sheetId: string,
    @Param('row') row: string,
    @Param('col') col: string,
  ) {
    return this.commentsService.getCommentsForCell(
      req.user.id,
      sheetId,
      parseInt(row, 10),
      parseInt(col, 10),
    );
  }

  @Post(':commentId/reply')
  addReply(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
    @Body() dto: { content: string },
  ) {
    return this.commentsService.addReply(req.user.id, commentId, dto);
  }

  @Put(':commentId')
  updateComment(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
    @Body() dto: { content: string },
  ) {
    return this.commentsService.updateComment(
      req.user.id,
      commentId,
      dto.content,
    );
  }

  @Delete(':commentId')
  deleteComment(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.deleteComment(req.user.id, commentId);
  }

  @Put(':commentId/resolve')
  resolveComment(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
    @Body() dto: { resolved: boolean },
  ) {
    return this.commentsService.resolveComment(
      req.user.id,
      commentId,
      dto.resolved,
    );
  }
}
