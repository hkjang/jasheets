'use client';

import { useState } from 'react';
import styles from './CommentsPanel.module.css';

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

interface Comment {
  id: string;
  row: number;
  col: number;
  content: string;
  author: Author;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
}

interface CommentsPanelProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (row: number, col: number, content: string) => void;
  onReply: (commentId: string, content: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onDelete: (commentId: string) => void;
  selectedCell: { row: number; col: number } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentsPanel({
  comments,
  currentUserId,
  onAddComment,
  onReply,
  onResolve,
  onDelete,
  selectedCell,
  isOpen,
  onClose,
}: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleAddComment = () => {
    if (!selectedCell || !newComment.trim()) return;
    onAddComment(selectedCell.row, selectedCell.col, newComment);
    setNewComment('');
  };

  const handleReply = (commentId: string) => {
    if (!replyContent.trim()) return;
    onReply(commentId, replyContent);
    setReplyingTo(null);
    setReplyContent('');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const cellComments = selectedCell
    ? comments.filter(c => c.row === selectedCell.row && c.col === selectedCell.col)
    : comments;

  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>💬 댓글</h3>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      {selectedCell && (
        <div className={styles.newComment}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            rows={2}
          />
          <button onClick={handleAddComment} disabled={!newComment.trim()}>
            추가
          </button>
        </div>
      )}

      <div className={styles.list}>
        {cellComments.length === 0 ? (
          <div className={styles.empty}>
            {selectedCell ? '이 셀에 댓글이 없습니다.' : '댓글이 없습니다.'}
          </div>
        ) : (
          cellComments.map((comment) => (
            <div
              key={comment.id}
              className={`${styles.comment} ${comment.resolved ? styles.resolved : ''}`}
            >
              <div className={styles.commentHeader}>
                <div className={styles.author}>
                  <div
                    className={styles.avatar}
                    style={{ backgroundColor: getAvatarColor(comment.author.id) }}
                  >
                    {(comment.author.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className={styles.name}>{comment.author.name || '알 수 없음'}</span>
                </div>
                <span className={styles.time}>{formatDate(comment.createdAt)}</span>
              </div>

              <div className={styles.content}>{comment.content}</div>

              <div className={styles.actions}>
                <button onClick={() => setReplyingTo(comment.id)}>답글</button>
                <button onClick={() => onResolve(comment.id, !comment.resolved)}>
                  {comment.resolved ? '다시 열기' : '해결'}
                </button>
                {comment.author.id === currentUserId && (
                  <button onClick={() => onDelete(comment.id)}>삭제</button>
                )}
              </div>

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className={styles.replies}>
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className={styles.reply}>
                      <div className={styles.replyHeader}>
                        <span className={styles.replyAuthor}>
                          {reply.author.name || '알 수 없음'}
                        </span>
                        <span className={styles.time}>{formatDate(reply.createdAt)}</span>
                      </div>
                      <div className={styles.replyContent}>{reply.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {replyingTo === comment.id && (
                <div className={styles.replyInput}>
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="답글 입력..."
                    autoFocus
                  />
                  <button onClick={() => handleReply(comment.id)}>전송</button>
                  <button onClick={() => setReplyingTo(null)}>취소</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getAvatarColor(userId: string): string {
  const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#9c27b0', '#00bcd4'];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
