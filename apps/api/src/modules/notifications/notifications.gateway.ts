import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const sockets = this.userSockets.get(data.userId) ?? new Set();
    sockets.add(client.id);
    this.userSockets.set(data.userId, sockets);
    
    client.join(`user:${data.userId}`);
    return { subscribed: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const sockets = this.userSockets.get(data.userId);
    if (sockets) {
      sockets.delete(client.id);
    }
    
    client.leave(`user:${data.userId}`);
    return { unsubscribed: true };
  }

  // Send notification to user in real-time
  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  // Send unread count update
  sendUnreadCount(userId: string, count: number) {
    this.server.to(`user:${userId}`).emit('unread-count', { count });
  }
}
