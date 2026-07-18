import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SheetsService } from '../sheets/sheets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { reduceOperationLog, SnapshotCell } from './operation-log.util';
import {
  getWebSocketUser,
  WebSocketAuthService,
  WebSocketUser,
} from '../auth/websocket-auth.service';
import { websocketCors } from '../../config/cors.config';
import { Prisma } from '@prisma/client';

interface UserPresence {
  id: string;
  name: string;
  color: string;
  selection?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  cursor?: {
    row: number;
    col: number;
  };
  lastSeenAt: number;
}

interface RoomState {
  spreadsheetId: string;
  users: Map<string, UserPresence>;
}

@WebSocketGateway({
  cors: websocketCors,
  namespace: '/collaboration',
})
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private rooms: Map<string, RoomState> = new Map();
  private userColors = [
    '#4285f4',
    '#ea4335',
    '#34a853',
    '#fbbc04',
    '#9c27b0',
    '#00bcd4',
    '#ff5722',
    '#795548',
  ];
  private colorIndex = 0;

  constructor(
    private readonly sheetsService: SheetsService,
    private readonly prisma: PrismaService,
    private readonly websocketAuth: WebSocketAuthService,
  ) {}

  afterInit(server: Server) {
    this.websocketAuth.attach(server);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeUserFromAllRooms(client);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string; lastSequence?: number },
  ) {
    const { spreadsheetId } = data;
    const user = this.getAuthenticatedUser(client);
    if (!(await this.sheetsService.checkAccess(user.id, spreadsheetId))) {
      throw new Error('You do not have access to this spreadsheet');
    }
    const roomId = `sheet:${spreadsheetId}`;

    // Join the room
    await client.join(roomId);

    // Initialize room if not exists
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        spreadsheetId,
        users: new Map(),
      });
    }

    // Add user to room
    const room = this.rooms.get(roomId)!;
    const userPresence: UserPresence = {
      id: user.id,
      name: user.name || user.email,
      color: this.getNextColor(),
      lastSeenAt: Date.now(),
    };

    room.users.set(client.id, userPresence);

    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      socketId: client.id,
      user: userPresence,
    });

    // Send current users to the joining client
    const currentUsers = Array.from(room.users.entries()).map(
      ([socketId, user]) => ({
        socketId,
        user,
      }),
    );

    const requestedSequence = Number(data.lastSequence ?? 0);
    const lastSequence = BigInt(
      Number.isSafeInteger(requestedSequence) && requestedSequence > 0
        ? requestedSequence
        : 0,
    );
    const operations = await this.prisma.collaborationOperation.findMany({
      where: { spreadsheetId, id: { gt: lastSequence } },
      orderBy: { id: 'asc' },
      take: 1000,
    });
    return {
      users: currentUsers,
      operations: operations.map((operation) => ({
        sequence: Number(operation.id),
        event: operation.event,
        payload: operation.payload,
      })),
      sequence:
        operations.length > 0
          ? Number(operations[operations.length - 1].id)
          : Number(lastSequence),
    };
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;
    this.removeUserFromRoom(client, roomId);
    await client.leave(roomId);
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string; row: number; col: number },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;
    const room = this.rooms.get(roomId);

    if (room && room.users.has(client.id)) {
      const user = room.users.get(client.id)!;
      user.lastSeenAt = Date.now();
      user.cursor = { row: data.row, col: data.col };

      client.to(roomId).emit('cursor-updated', {
        socketId: client.id,
        cursor: user.cursor,
      });
    }
  }

  @SubscribeMessage('selection-change')
  handleSelectionChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      spreadsheetId: string;
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;
    const room = this.rooms.get(roomId);

    if (room && room.users.has(client.id)) {
      const user = room.users.get(client.id)!;
      user.lastSeenAt = Date.now();
      user.selection = {
        startRow: data.startRow,
        startCol: data.startCol,
        endRow: data.endRow,
        endCol: data.endCol,
      };

      client.to(roomId).emit('selection-updated', {
        socketId: client.id,
        selection: user.selection,
      });
    }
  }

  @SubscribeMessage('cell-update')
  async handleCellUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      spreadsheetId: string;
      sheetId: string;
      row: number;
      col: number;
      value: unknown;
      formula?: string;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;

    const operation = await this.appendOperation(
      client,
      data.spreadsheetId,
      data.sheetId,
      'cell-updated',
      {
        socketId: client.id,
        sheetId: data.sheetId,
        row: data.row,
        col: data.col,
        value: data.value,
        formula: data.formula,
      },
    );

    // Broadcast the update to all other clients in the room
    client.to(roomId).emit('cell-updated', {
      socketId: client.id,
      sheetId: data.sheetId,
      row: data.row,
      col: data.col,
      value: data.value,
      formula: data.formula,
      sequence: operation.sequence,
    });

    // Note: In production, you would also persist to database here
    // via sheetsService.updateCell()
  }

  @SubscribeMessage('batch-update')
  async handleBatchUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      spreadsheetId: string;
      sheetId: string;
      updates: Array<{
        row: number;
        col: number;
        value: unknown;
        formula?: string;
      }>;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;

    const operation = await this.appendOperation(
      client,
      data.spreadsheetId,
      data.sheetId,
      'cells-updated',
      {
        socketId: client.id,
        sheetId: data.sheetId,
        updates: data.updates,
      },
    );

    client.to(roomId).emit('cells-updated', {
      socketId: client.id,
      sheetId: data.sheetId,
      updates: data.updates,
      sequence: operation.sequence,
    });
  }

  @SubscribeMessage('presence-heartbeat')
  handlePresenceHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string },
  ) {
    const room = this.rooms.get(`sheet:${data.spreadsheetId}`);
    const user = room?.users.get(client.id);
    if (user) user.lastSeenAt = Date.now();
  }

  @SubscribeMessage('crdt-update')
  async handleCrdtUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string; update: number[] },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;
    const user = this.getAuthenticatedUser(client);
    if (!this.isRoomMember(client, roomId)) return;
    await this.sheetsService.checkEditAccess(user.id, data.spreadsheetId);

    // Broadcast CRDT update to all other clients
    client.to(roomId).emit('crdt-update', {
      socketId: client.id,
      update: data.update,
    });
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      spreadsheetId: string;
      content: string;
      timestamp: number;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;
    const room = this.rooms.get(roomId);

    if (room && room.users.has(client.id)) {
      const sender = room.users.get(client.id)!;
      const message = {
        id: `msg_${Date.now()}_${client.id.substring(0, 8)}`,
        senderId: sender.id,
        senderName: sender.name,
        content: data.content,
        timestamp: data.timestamp,
      };

      // Broadcast to all users in room including sender
      this.server.to(roomId).emit('chat-message', message);

      this.logger.log(
        `Chat message in ${roomId} from ${sender.name}: ${data.content.substring(0, 50)}`,
      );
    }
  }

  private removeUserFromRoom(client: Socket, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.users.has(client.id)) {
      room.users.delete(client.id);

      this.server.to(roomId).emit('user-left', {
        socketId: client.id,
      });

      // Clean up empty rooms
      if (room.users.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  private removeUserFromAllRooms(client: Socket): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.has(client.id)) {
        this.removeUserFromRoom(client, roomId);
      }
    }
  }

  private getNextColor(): string {
    const color = this.userColors[this.colorIndex % this.userColors.length];
    this.colorIndex++;
    return color;
  }

  private getAuthenticatedUser(client: Socket): WebSocketUser {
    return getWebSocketUser(client);
  }

  private isRoomMember(client: Socket, roomId: string): boolean {
    return (
      client.rooms.has(roomId) &&
      Boolean(this.rooms.get(roomId)?.users.has(client.id))
    );
  }

  private async appendOperation(
    client: Socket,
    spreadsheetId: string,
    sheetId: string,
    event: 'cell-updated' | 'cells-updated',
    payload: Record<string, unknown>,
  ): Promise<{ sequence: number }> {
    const room = this.rooms.get(`sheet:${spreadsheetId}`);
    const user = room?.users.get(client.id);
    if (!user) throw new Error('Client must join before editing');
    await this.sheetsService.checkEditAccess(user.id, spreadsheetId);
    const sheet = await this.prisma.sheet.findFirst({
      where: { id: sheetId, spreadsheetId },
      select: { id: true },
    });
    if (!sheet) throw new Error('Sheet does not belong to spreadsheet');
    const operation = await this.prisma.collaborationOperation.create({
      data: {
        spreadsheetId,
        sheetId,
        userId: user.id,
        event,
        payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      },
    });
    await this.createPeriodicSnapshot(spreadsheetId, sheetId, operation.id);
    return { sequence: Number(operation.id) };
  }

  private async createPeriodicSnapshot(
    spreadsheetId: string,
    sheetId: string,
    sequence: bigint,
  ): Promise<void> {
    const operationCount = await this.prisma.collaborationOperation.count({
      where: { sheetId },
    });
    if (operationCount % 100 !== 0) return;
    const previous = await this.prisma.collaborationSnapshot.findFirst({
      where: { sheetId },
      orderBy: { sequence: 'desc' },
    });
    const operations = await this.prisma.collaborationOperation.findMany({
      where: { sheetId, id: { gt: previous?.sequence ?? 0n, lte: sequence } },
      orderBy: { id: 'asc' },
    });
    const previousState = previous?.state as unknown as
      { cells?: SnapshotCell[] } | undefined;
    const cells = reduceOperationLog(
      operations.map((operation) => ({
        sequence: Number(operation.id),
        event: operation.event,
        payload: operation.payload,
      })),
      previousState?.cells ?? [],
    );
    await this.prisma.collaborationSnapshot.create({
      data: {
        spreadsheetId,
        sheetId,
        sequence,
        state: JSON.parse(JSON.stringify({ cells })) as Prisma.InputJsonValue,
      },
    });
  }
}
