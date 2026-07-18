import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { AuthService, type JwtPayload } from './auth.service';

export interface WebSocketUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

@Injectable()
export class WebSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  attach(server: Server): void {
    server.use((socket, next) => {
      void this.authenticate(socket).then(
        (user) => {
          (socket.data as { user?: WebSocketUser }).user = user;
          next();
        },
        () => next(new Error('Unauthorized')),
      );
    });
  }

  async authenticate(socket: Socket): Promise<WebSocketUser> {
    const authorization = socket.handshake.headers.authorization;
    const headerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    const auth = socket.handshake.auth as { token?: unknown };
    const token = typeof auth.token === 'string' ? auth.token : headerToken;

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('WebSocket authentication required');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    const user = await this.authService.validateUser(payload);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    };
  }
}

export function getWebSocketUser(socket: Socket): WebSocketUser {
  const user = (socket.data as { user?: WebSocketUser }).user;
  if (!user)
    throw new UnauthorizedException('WebSocket authentication required');
  return user;
}
