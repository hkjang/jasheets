'use client';

import { useState } from 'react';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onFormat: (format: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  alignment: 'left' | 'center' | 'right';
  onInsertChart?: () => void;
  onShare?: () => void;
  onInsertPivot?: () => void;
  onConditionalFormatting?: () => void;
  onShortcuts?: () => void;
  onAdmin?: () => void;
  onComments?: () => void;
  onAI?: () => void;
}

export default function Toolbar({
  onUndo,
  onRedo,
  onBold,
  onItalic,
  onUnderline,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onFormat,
  canUndo,
  canRedo,
  isBold,
  isItalic,
  isUnderline,
  alignment,
  onInsertChart,
  onShare,
  onInsertPivot,
  onConditionalFormatting,
  onShortcuts,
  onAdmin,
  onComments,
  onAI,
}: ToolbarProps) {
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  return (
    <div className={styles.container}>
      {/* Undo/Redo */}
      <div className={styles.group}>
        <button
          className={styles.button}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
          </svg>
        </button>
        <button
          className={styles.button}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
          </svg>
        </button>
      </div>

      <div className={styles.separator} />

      {/* Font formatting */}
      <div className={styles.group}>
        <button
          className={`${styles.button} ${isBold ? styles.active : ''}`}
          onClick={onBold}
          title="Bold (Ctrl+B)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </button>
        <button
          className={`${styles.button} ${isItalic ? styles.active : ''}`}
          onClick={onItalic}
          title="Italic (Ctrl+I)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </button>
        <button
          className={`${styles.button} ${isUnderline ? styles.active : ''}`}
          onClick={onUnderline}
          title="Underline (Ctrl+U)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </button>
      </div>

      <div className={styles.separator} />

      {/* Alignment */}
      <div className={styles.group}>
        <button
          className={`${styles.button} ${alignment === 'left' ? styles.active : ''}`}
          onClick={onAlignLeft}
          title="Align left"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
          </svg>
        </button>
        <button
          className={`${styles.button} ${alignment === 'center' ? styles.active : ''}`}
          onClick={onAlignCenter}
          title="Align center"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
          </svg>
        </button>
        <button
          className={`${styles.button} ${alignment === 'right' ? styles.active : ''}`}
          onClick={onAlignRight}
          title="Align right"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>
          </svg>
        </button>
      </div>

      <div className={styles.separator} />

      {/* Chart */}
      <div className={styles.group}>
        <button
          className={styles.button}
          onClick={onInsertChart}
          title="Insert Chart"
          disabled={!onInsertChart}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </button>
      </div>

       <div className={styles.separator} />

      {/* Data Features */}
      <div className={styles.group}>
          <button 
             className={styles.button}
             onClick={onConditionalFormatting}
             title="Conditional Formatting"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 10H8v-2h7v2zm2-4H8V7h9v2z"/>
            </svg>
          </button>
          
          <button 
             className={styles.button}
             onClick={onInsertPivot}
             title="Pivot Table"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M10 3h11v5H10V3zm-7 7h5v11H3V10zm0-7h5v5H3V3zm7 7h11v11H10V10z"/>
            </svg>
          </button>
      </div>
      
      <div className={styles.separator} />

      {/* Number format */}
      <div className={styles.group}>
        <div className={styles.dropdown}>
          <button
            className={styles.dropdownButton}
            onClick={() => setShowFormatMenu(!showFormatMenu)}
            title="Number format"
          >
            <span>123</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          {showFormatMenu && (
            <div className={styles.dropdownMenu}>
              <button onClick={() => { onFormat('general'); setShowFormatMenu(false); }}>General</button>
              <button onClick={() => { onFormat('number'); setShowFormatMenu(false); }}>Number</button>
              <button onClick={() => { onFormat('currency'); setShowFormatMenu(false); }}>Currency</button>
              <button onClick={() => { onFormat('percent'); setShowFormatMenu(false); }}>Percent</button>
              <button onClick={() => { onFormat('date'); setShowFormatMenu(false); }}>Date</button>
              <button onClick={() => { onFormat('time'); setShowFormatMenu(false); }}>Time</button>
            </div>
          )}
        </div>
      </div>

       <div className={styles.separator} />

      {/* Extra Features */}
      <div className={styles.group}>
          <button 
             className={styles.button}
             onClick={onShortcuts}
             title="Keyboard Shortcuts (Ctrl+/)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
               <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
            </svg>
          </button>
          
          {onAdmin && (
             <button
               className={styles.button}
               onClick={onAdmin}
               title="Admin Dashboard"
               style={{ color: '#d93025' }}
             >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
             </button>
          )}
          
          {onComments && (
             <button
               className={styles.button}
               onClick={onComments}
               title="댓글"
             >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
             </button>
          )}
          
          {onAI && (
             <button
               className={styles.button}
               onClick={onAI}
               title="AI 수식 도우미"
               style={{ color: '#9c27b0' }}
             >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M21 11.5v-1c0-.8-.7-1.5-1.5-1.5H16v6h1.5v-2h1.1l.9 2H21l-.9-2.1c.5-.3.9-.8.9-1.4zm-1.5 0h-2v-1h2v1zm-13-.5h-2v3H3v-3H1V17h1.5v-3h2v3H6V11h-.5zM13 11H9v6h4c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5zm0 4.5h-2.5V12.5H13v3z"/>
                </svg>
             </button>
          )}
      </div>

      <div className={styles.separator} />

      {/* Share */}
      <div className={styles.group}>
          <button
            className={styles.button}
            onClick={onShare}
            title="Share"
            style={{ color: '#1a73e8' }} // Blue color to make it stand out
          >
           <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
           </svg>
          </button>
      </div>
    </div>
  );
}
