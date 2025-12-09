'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

  // Fetch comments from API
  const fetchComments = useCallback(async () => {
    if (!sheetId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${apiUrl}/comments/sheet/${sheetId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      
      const data = await response.json();
      setComments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [sheetId, apiUrl]);

  // Initialize websocket connection
  useEffect(() => {
    if (!sheetId) return;

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

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${apiUrl}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ sheetId, row, col, content }),
    });

    if (!response.ok) {
      throw new Error('Failed to add comment');
    }

    // WebSocket will broadcast the new comment
  }, [sheetId, apiUrl]);

  const replyToComment = useCallback(async (commentId: string, content: string) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${apiUrl}/comments/${commentId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to reply to comment');
    }

    // Refetch to get updated replies
    await fetchComments();
  }, [apiUrl, fetchComments]);

  const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${apiUrl}/comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ resolved }),
    });

    if (!response.ok) {
      throw new Error('Failed to resolve comment');
    }

    // WebSocket will broadcast the update
  }, [apiUrl]);

  const deleteComment = useCallback(async (commentId: string) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${apiUrl}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete comment');
    }

    // WebSocket will broadcast the deletion
  }, [apiUrl]);

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
