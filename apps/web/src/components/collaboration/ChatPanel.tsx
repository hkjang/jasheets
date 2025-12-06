'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';
import { ChatMessage } from '@/hooks/useCollaboration';

interface ChatPanelProps {
  currentUserId: string;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

export default function ChatPanel({
  currentUserId,
  messages,
  onSendMessage,
  isOpen,
  onToggle,
  unreadCount = 0
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    onSendMessage(inputValue);
    setInputValue('');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) {
    return (
      <button 
        className={`${styles.floatingToggle} ${unreadCount > 0 ? styles.hasUnread : ''}`}
        onClick={onToggle}
        aria-label="Open chat"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
    );
  }

  return (
    <div className={`${styles.container} ${isOpen ? styles.maximized : styles.minimized}`}>
      <div className={styles.header}>
        <h3>채팅</h3>
        <button 
          className={styles.minimizeBtn}
          onClick={onToggle}
          aria-label="Close chat"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div className={styles.messageList}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '14px' }}>
            💬 대화를 시작해보세요
          </div>
        )}
        
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          
          return (
            <div key={msg.id} className={`${styles.message} ${isOwn ? styles.own : ''}`}>
              {!isOwn && (
                <span className={styles.senderName}>{msg.senderName}</span>
              )}
              <div className={styles.bubble}>
                {msg.content}
              </div>
              <span className={styles.timestamp}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            type="text"
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="메시지 입력..."
            maxLength={500}
          />
          <button 
            type="submit" 
            className={styles.sendBtn}
            disabled={!inputValue.trim()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
