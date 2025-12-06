import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SheetsService } from '../sheets/sheets.service';

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
}

interface RoomState {
  spreadsheetId: string;
  users: Map<string, UserPresence>;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/collaboration',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private rooms: Map<string, RoomState> = new Map();
  private userColors = [
    '#4285f4', '#ea4335', '#34a853', '#fbbc04',
    '#9c27b0', '#00bcd4', '#ff5722', '#795548',
  ];
  private colorIndex = 0;

  constructor(private readonly sheetsService: SheetsService) {}

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
    @MessageBody() data: { spreadsheetId: string; userId: string; userName: string },
  ) {
    const { spreadsheetId, userId, userName } = data;
    const roomId = `sheet:${spreadsheetId}`;

    // Join the room
    client.join(roomId);

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
      id: userId,
      name: userName,
      color: this.getNextColor(),
    };

    room.users.set(client.id, userPresence);

    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      socketId: client.id,
      user: userPresence,
    });

    // Send current users to the joining client
    const currentUsers = Array.from(room.users.entries()).map(([socketId, user]) => ({
      socketId,
      user,
    }));

    return { users: currentUsers };
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { spreadsheetId: string }) {
    const roomId = `sheet:${data.spreadsheetId}`;
    this.removeUserFromRoom(client, roomId);
    client.leave(roomId);
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
    @MessageBody() data: {
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
    @MessageBody() data: {
      spreadsheetId: string;
      sheetId: string;
      row: number;
      col: number;
      value: any;
      formula?: string;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;

    // Broadcast the update to all other clients in the room
    client.to(roomId).emit('cell-updated', {
      socketId: client.id,
      sheetId: data.sheetId,
      row: data.row,
      col: data.col,
      value: data.value,
      formula: data.formula,
    });

    // Note: In production, you would also persist to database here
    // via sheetsService.updateCell()
  }

  @SubscribeMessage('batch-update')
  async handleBatchUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      spreadsheetId: string;
      sheetId: string;
      updates: Array<{
        row: number;
        col: number;
        value: any;
        formula?: string;
      }>;
    },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;

    client.to(roomId).emit('cells-updated', {
      socketId: client.id,
      sheetId: data.sheetId,
      updates: data.updates,
    });
  }

  @SubscribeMessage('crdt-update')
  handleCrdtUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { spreadsheetId: string; update: number[] },
  ) {
    const roomId = `sheet:${data.spreadsheetId}`;

    // Broadcast CRDT update to all other clients
    client.to(roomId).emit('crdt-update', {
      socketId: client.id,
      update: data.update,
    });
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
}
