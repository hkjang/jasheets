'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth-session';
import type { CellValue } from '@/types/spreadsheet';
import type { PersistedCellFormat } from '@/utils/cellPersistence';

export interface CellUpdate {
  sheetId: string;
  row: number;
  col: number;
  value: CellValue;
  formula?: string;
  format?: PersistedCellFormat | null;
  sequence?: number;
}

interface CellsUpdate {
  sheetId: string;
  updates: Array<Omit<CellUpdate, 'sheetId' | 'sequence'>>;
  sequence?: number;
}

interface UserPresence {
  socketId?: string;
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
  lastSeenAt?: number;
}

interface UseCollaborationOptions {
  spreadsheetId: string;
  userId: string;
  userName: string;
  wsUrl?: string;
  onCellUpdate?: (data: CellUpdate) => void;
  onCellsUpdate?: (data: CellsUpdate) => void;
  onChatMessage?: (message: ChatMessage) => void;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

interface UseCollaborationReturn {
  isConnected: boolean;
  syncStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  users: UserPresence[];
  sendCellUpdate: (sheetId: string, row: number, col: number, value: CellValue, formula?: string, format?: PersistedCellFormat | null) => void;
  sendBatchUpdate: (sheetId: string, updates: CellsUpdate['updates']) => void;
  sendCursorMove: (row: number, col: number) => void;
  sendSelectionChange: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
  sendChatMessage: (content: string) => void;
}

export function useCollaboration({
  spreadsheetId,
  userId,
  userName,
  wsUrl = 'http://localhost:4000/collaboration',
  onCellUpdate,
  onCellsUpdate,
  onChatMessage,
}: UseCollaborationOptions): UseCollaborationReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<UseCollaborationReturn['syncStatus']>('connecting');
  const [users, setUsers] = useState<UserPresence[]>([]);
  const lastSequenceRef = useRef(0);

  const onCellUpdateRef = useRef(onCellUpdate);
  const onCellsUpdateRef = useRef(onCellsUpdate);
  const onChatMessageRef = useRef(onChatMessage);

  useEffect(() => {
    onCellUpdateRef.current = onCellUpdate;
    onCellsUpdateRef.current = onCellsUpdate;
    onChatMessageRef.current = onChatMessage;
  }, [onCellUpdate, onCellsUpdate, onChatMessage]);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(wsUrl, {
      auth: (callback) => callback({ token: getAccessToken() }),
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setSyncStatus('connected');
      
      // Join the spreadsheet room
      socket.emit('join', {
        spreadsheetId,
        userId,
        userName,
        lastSequence: lastSequenceRef.current,
      }, (response: {
        users: Array<{ socketId: string; user: UserPresence }>;
        operations?: Array<
          | { sequence: number; event: 'cell-updated'; payload: CellUpdate }
          | { sequence: number; event: 'cells-updated'; payload: CellsUpdate }
        >;
        sequence?: number;
      }) => {
        if (response?.users) {
          setUsers(response.users.map(u => ({ ...u.user, socketId: u.socketId })));
        }
        response?.operations?.forEach((operation) => {
          if (operation.event === 'cell-updated') onCellUpdateRef.current?.(operation.payload);
          else onCellsUpdateRef.current?.(operation.payload);
          lastSequenceRef.current = Math.max(lastSequenceRef.current, operation.sequence);
        });
        lastSequenceRef.current = Math.max(lastSequenceRef.current, response?.sequence ?? 0);
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setSyncStatus('reconnecting');
    });

    // Handle user events
    socket.on('user-joined', (data: { socketId: string; user: UserPresence }) => {
      setUsers(prev => [...prev.filter(u => u.socketId !== data.socketId), { ...data.user, socketId: data.socketId }]);
    });

    socket.on('user-left', (data: { socketId: string }) => {
      setUsers(prev => prev.filter(user => user.socketId !== data.socketId));
    });

    // Handle cursor updates
    socket.on('cursor-updated', (data: { socketId: string; cursor: { row: number; col: number } }) => {
      setUsers(prev => prev.map(user => user.socketId === data.socketId
        ? { ...user, cursor: data.cursor, lastSeenAt: Date.now() }
        : user));
    });

    // Handle selection updates
    socket.on('selection-updated', (data: { socketId: string; selection: UserPresence['selection'] }) => {
      setUsers(prev => prev.map(user => user.socketId === data.socketId
        ? { ...user, selection: data.selection, lastSeenAt: Date.now() }
        : user));
    });

    // Handle cell updates
    socket.on('cell-updated', (data: CellUpdate & { socketId: string }) => {
      lastSequenceRef.current = Math.max(lastSequenceRef.current, data.sequence ?? 0);
      onCellUpdateRef.current?.(data);
    });

    socket.on('cells-updated', (data: CellsUpdate & { socketId: string }) => {
      lastSequenceRef.current = Math.max(lastSequenceRef.current, data.sequence ?? 0);
      onCellsUpdateRef.current?.(data);
    });

    // Handle chat messages
    socket.on('chat-message', (message: ChatMessage) => {
      onChatMessageRef.current?.(message);
    });

    socket.io.on('reconnect_attempt', () => setSyncStatus('reconnecting'));
    socket.on('connect_error', () => setSyncStatus('disconnected'));

    const heartbeat = window.setInterval(() => {
      socket.emit('presence-heartbeat', { spreadsheetId });
      const cutoff = Date.now() - 45000;
      setUsers(current => current.filter(user => (user.lastSeenAt ?? Date.now()) >= cutoff));
    }, 15000);

    return () => {
      socket.emit('leave', { spreadsheetId });
      socket.disconnect();
      window.clearInterval(heartbeat);
    };
  }, [spreadsheetId, userId, userName, wsUrl]);

  // Send cell update
  const sendCellUpdate = useCallback((
    sheetId: string,
    row: number,
    col: number,
    value: CellValue,
    formula?: string,
    format?: PersistedCellFormat | null,
  ) => {
    socketRef.current?.emit('cell-update', {
      spreadsheetId,
      sheetId,
      row,
      col,
      value,
      formula,
      format,
    });
  }, [spreadsheetId]);

  // Send batch update
  const sendBatchUpdate = useCallback((
    sheetId: string,
    updates: CellsUpdate['updates'],
  ) => {
    socketRef.current?.emit('batch-update', {
      spreadsheetId,
      sheetId,
      updates,
    });
  }, [spreadsheetId]);

  // Send cursor move
  const sendCursorMove = useCallback((row: number, col: number) => {
    socketRef.current?.emit('cursor-move', {
      spreadsheetId,
      row,
      col,
      value: null // Placeholder if needed by backend schema
    });
  }, [spreadsheetId]);

  // Send selection change
  const sendSelectionChange = useCallback((
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) => {
    socketRef.current?.emit('selection-change', {
      spreadsheetId,
      startRow,
      startCol,
      endRow,
      endCol,
    });
  }, [spreadsheetId]);

  // Send chat message
  const sendChatMessage = useCallback((content: string) => {
    socketRef.current?.emit('chat-message', {
      spreadsheetId,
      content,
      timestamp: Date.now(),
    });
  }, [spreadsheetId]);

  return {
    isConnected,
    syncStatus,
    users,
    sendCellUpdate,
    sendBatchUpdate,
    sendCursorMove,
    sendSelectionChange,
    sendChatMessage,
  };
}

export default useCollaboration;
