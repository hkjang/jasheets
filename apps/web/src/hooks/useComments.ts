'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ApiClient } from '@/lib/api-client';

interface Author {
  id: string;
  name: string | null;
  avatar: string | null;
}

interface Reply {
  id: string;
  content: string;
  author: Author;
  createdAt: string;
}

export interface Comment {
  id: string;
  row: number;
  col: number;
  content: string;
  author: Author;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
}

interface UseCommentsOptions {
  sheetId: string | null;
  apiUrl?: string;
  wsUrl?: string;
}

interface UseCommentsReturn {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
  addComment: (row: number, col: number, content: string) => Promise<void>;
  replyToComment: (commentId: string, content: string) => Promise<void>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useComments({
  sheetId,
  apiUrl = 'http://localhost:4000/api',
  wsUrl = 'http://localhost:4000/comments',
}: UseCommentsOptions): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const client = useMemo(() => new ApiClient(apiUrl), [apiUrl]);

  // Fetch comments from API
  const fetchComments = useCallback(async () => {
    if (!sheetId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await client.request<Comment[]>(`/comments/sheet/${sheetId}`);
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [sheetId, client]);

  // Initialize websocket connection
  useEffect(() => {
    if (!sheetId) return;
    
    // Skip WebSocket in development to avoid Fast Refresh issues
    if (process.env.NODE_ENV === 'development') {
      console.log('[useComments] WebSocket disabled in development mode');
      return;
    }

    const socket = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { sheetId });
    });

    // Handle real-time comment updates
    socket.on('comment:created', (comment: Comment) => {
      setComments(prev => [comment, ...prev]);
    });

    socket.on('comment:updated', (updatedComment: Comment) => {
      setComments(prev => 
        prev.map(c => c.id === updatedComment.id ? updatedComment : c)
      );
    });

    socket.on('comment:deleted', ({ commentId }: { commentId: string }) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
    });

    return () => {
      socket.emit('unsubscribe', { sheetId });
      socket.disconnect();
    };
  }, [sheetId, wsUrl]);

  // Fetch comments on mount
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(async (row: number, col: number, content: string) => {
    if (!sheetId) return;

    const comment = await client.request<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify({ sheetId, row, col, content }),
    });
    setComments((previous) => previous.some(({ id }) => id === comment.id) ? previous : [comment, ...previous]);
  }, [sheetId, client]);

  const replyToComment = useCallback(async (commentId: string, content: string) => {
    await client.request<Reply>(`/comments/${commentId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    // Refetch to get updated replies
    await fetchComments();
  }, [client, fetchComments]);

  const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    const updated = await client.request<Comment>(`/comments/${commentId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolved }),
    });
    setComments((previous) => previous.map((comment) => comment.id === updated.id ? updated : comment));
  }, [client]);

  const deleteComment = useCallback(async (commentId: string) => {
    await client.request<Comment>(`/comments/${commentId}`, {
      method: 'DELETE',
    });
    setComments((previous) => previous.filter((comment) => comment.id !== commentId));
  }, [client]);

  return {
    comments,
    isLoading,
    error,
    addComment,
    replyToComment,
    resolveComment,
    deleteComment,
    refetch: fetchComments,
  };
}

export default useComments;
