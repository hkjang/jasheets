'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

interface UseCollaborationOptions {
  spreadsheetId: string;
  userId: string;
  userName: string;
  wsUrl?: string;
  onCellUpdate?: (data: {
    sheetId: string;
    row: number;
    col: number;
    value: any;
    formula?: string;
  }) => void;
  onCellsUpdate?: (data: {
    sheetId: string;
    updates: Array<{ row: number; col: number; value: any; formula?: string }>;
  }) => void;
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
  users: UserPresence[];
  sendCellUpdate: (sheetId: string, row: number, col: number, value: any, formula?: string) => void;
  sendBatchUpdate: (sheetId: string, updates: Array<{ row: number; col: number; value: any; formula?: string }>) => void;
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
  const [users, setUsers] = useState<UserPresence[]>([]);

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
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Join the spreadsheet room
      socket.emit('join', {
        spreadsheetId,
        userId,
        userName,
      }, (response: { users: Array<{ socketId: string; user: UserPresence }> }) => {
        if (response?.users) {
          setUsers(response.users.map(u => u.user));
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle user events
    socket.on('user-joined', (data: { socketId: string; user: UserPresence }) => {
      setUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user]);
    });

    socket.on('user-left', (data: { socketId: string }) => {
      setUsers(prev => prev.filter((_, index) => {
        // This is a simplified approach - in production, map socketId to userId
        return true; 
      }));
    });

    // Handle cursor updates
    socket.on('cursor-updated', (data: { socketId: string; cursor: { row: number; col: number } }) => {
      setUsers(prev => prev.map(user => {
        // Update cursor for the user
        return { ...user, cursor: data.cursor };
      }));
    });

    // Handle selection updates
    socket.on('selection-updated', (data: { socketId: string; selection: UserPresence['selection'] }) => {
      setUsers(prev => prev.map(user => {
        return { ...user, selection: data.selection };
      }));
    });

    // Handle cell updates
    socket.on('cell-updated', (data: {
      socketId: string;
      sheetId: string;
      row: number;
      col: number;
      value: any;
      formula?: string;
    }) => {
      onCellUpdateRef.current?.(data);
    });

    socket.on('cells-updated', (data: {
      socketId: string;
      sheetId: string;
      updates: Array<{ row: number; col: number; value: any; formula?: string }>;
    }) => {
      onCellsUpdateRef.current?.(data);
    });

    // Handle chat messages
    socket.on('chat-message', (message: ChatMessage) => {
      onChatMessageRef.current?.(message);
    });

    return () => {
      socket.emit('leave', { spreadsheetId });
      socket.disconnect();
    };
  }, [spreadsheetId, userId, userName, wsUrl]);

  // Send cell update
  const sendCellUpdate = useCallback((
    sheetId: string,
    row: number,
    col: number,
    value: any,
    formula?: string,
  ) => {
    socketRef.current?.emit('cell-update', {
      spreadsheetId,
      sheetId,
      row,
      col,
      value,
      formula,
    });
  }, [spreadsheetId]);

  // Send batch update
  const sendBatchUpdate = useCallback((
    sheetId: string,
    updates: Array<{ row: number; col: number; value: any; formula?: string }>,
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
    users,
    sendCellUpdate,
    sendBatchUpdate,
    sendCursorMove,
    sendSelectionChange,
    sendChatMessage,
  };
}

export default useCollaboration;
