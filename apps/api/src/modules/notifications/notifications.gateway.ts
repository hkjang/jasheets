import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  getWebSocketUser,
  WebSocketAuthService,
  WebSocketUser,
} from '../auth/websocket-auth.service';
import { websocketCors } from '../../config/cors.config';

@WebSocketGateway({
  cors: websocketCors,
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly websocketAuth: WebSocketAuthService) {}

  afterInit(server: Server) {
    this.websocketAuth.attach(server);
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as { user?: WebSocketUser }).user;
    if (!user) return;
    const sockets = this.userSockets.get(user.id);
    sockets?.delete(client.id);
    if (sockets?.size === 0) this.userSockets.delete(user.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(@ConnectedSocket() client: Socket) {
    const user = getWebSocketUser(client);
    const sockets = this.userSockets.get(user.id) ?? new Set();
    sockets.add(client.id);
    this.userSockets.set(user.id, sockets);

    await client.join(`user:${user.id}`);
    return { subscribed: true };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(@ConnectedSocket() client: Socket) {
    const user = getWebSocketUser(client);
    const sockets = this.userSockets.get(user.id);
    if (sockets) {
      sockets.delete(client.id);
    }

    await client.leave(`user:${user.id}`);
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
