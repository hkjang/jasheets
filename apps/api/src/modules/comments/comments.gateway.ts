import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CommentsService } from './comments.service';
import {
  getWebSocketUser,
  WebSocketAuthService,
} from '../auth/websocket-auth.service';
import { websocketCors } from '../../config/cors.config';

@WebSocketGateway({
  cors: websocketCors,
  namespace: '/comments',
})
export class CommentsGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly commentsService: CommentsService,
    private readonly websocketAuth: WebSocketAuthService,
  ) {}

  afterInit(server: Server) {
    this.websocketAuth.attach(server);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sheetId: string },
  ) {
    const user = getWebSocketUser(client);
    await this.commentsService.assertSheetAccess(user.id, data.sheetId);
    await client.join(`sheet:${data.sheetId}`);
    return { subscribed: true };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sheetId: string },
  ) {
    await client.leave(`sheet:${data.sheetId}`);
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
