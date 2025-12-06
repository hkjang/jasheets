import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CommentsService } from './comments.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/comments',
})
export class CommentsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly commentsService: CommentsService) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sheetId: string },
  ) {
    client.join(`sheet:${data.sheetId}`);
    return { subscribed: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sheetId: string },
  ) {
    client.leave(`sheet:${data.sheetId}`);
    return { unsubscribed: true };
  }

  // Broadcast new comment to all subscribers
  notifyNewComment(sheetId: string, comment: any) {
    this.server.to(`sheet:${sheetId}`).emit('comment:created', comment);
  }

  // Broadcast updated comment
  notifyCommentUpdated(sheetId: string, comment: any) {
    this.server.to(`sheet:${sheetId}`).emit('comment:updated', comment);
  }

  // Broadcast deleted comment
  notifyCommentDeleted(sheetId: string, commentId: string) {
    this.server.to(`sheet:${sheetId}`).emit('comment:deleted', { commentId });
  }
}
