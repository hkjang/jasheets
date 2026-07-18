import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { AuthService } from './auth.service';
import { WebSocketAuthService } from './websocket-auth.service';

describe('WebSocketAuthService', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const authService = { validateUser: jest.fn() };
  const service = new WebSocketAuthService(
    jwtService as unknown as JwtService,
    authService as unknown as AuthService,
  );

  beforeEach(() => jest.clearAllMocks());

  function socket(
    auth: Record<string, unknown>,
    authorization?: string,
  ): Socket {
    return {
      handshake: { auth, headers: { authorization } },
    } as unknown as Socket;
  }

  it('authenticates a handshake token and exposes only safe identity fields', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
    });
    authService.validateUser.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      isAdmin: false,
      password: 'must-not-leak',
    });

    await expect(
      service.authenticate(socket({ token: 'access-token' })),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      isAdmin: false,
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token');
  });

  it('accepts a bearer token when handshake auth is absent', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
    });
    authService.validateUser.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: null,
      isAdmin: false,
    });

    await service.authenticate(socket({}, 'Bearer header-token'));
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token');
  });

  it('rejects a connection without a token', async () => {
    await expect(service.authenticate(socket({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
