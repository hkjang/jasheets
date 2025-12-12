import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  createComment(
    @Request() req: any,
    @Body() dto: { sheetId: string; row: number; col: number; content: string },
  ) {
    return this.commentsService.createComment(req.user.id, dto);
  }

  @Get('sheet/:sheetId')
  getComments(@Param('sheetId') sheetId: string) {
    return this.commentsService.getComments(sheetId);
  }

  @Get('sheet/:sheetId/cell/:row/:col')
  getCommentsForCell(
    @Param('sheetId') sheetId: string,
    @Param('row') row: string,
    @Param('col') col: string,
  ) {
    return this.commentsService.getCommentsForCell(
      sheetId,
      parseInt(row, 10),
      parseInt(col, 10),
    );
  }

  @Post(':commentId/reply')
  addReply(
    @Request() req: any,
    @Param('commentId') commentId: string,
    @Body() dto: { content: string },
  ) {
    return this.commentsService.addReply(req.user.id, commentId, dto);
  }

  @Put(':commentId')
  updateComment(
    @Request() req: any,
    @Param('commentId') commentId: string,
    @Body() dto: { content: string },
  ) {
    return this.commentsService.updateComment(req.user.id, commentId, dto.content);
  }

  @Delete(':commentId')
  deleteComment(@Request() req: any, @Param('commentId') commentId: string) {
    return this.commentsService.deleteComment(req.user.id, commentId);
  }

  @Put(':commentId/resolve')
  resolveComment(
    @Request() req: any,
    @Param('commentId') commentId: string,
    @Body() dto: { resolved: boolean },
  ) {
    return this.commentsService.resolveComment(req.user.id, commentId, dto.resolved);
  }
}

