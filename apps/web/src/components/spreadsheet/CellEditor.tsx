import React, { useEffect, useRef } from 'react';

interface CellEditorProps {
  position: { x: number; y: number; width: number; height: number };
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export default function CellEditor({ position, value, onChange, onCommit, onCancel }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Ensure cursor is at the end of the text
      // We only set this on mount. If value updates from parent, we don't want to jump cursor.
      // But if parent re-renders CellEditor completely (remount), this runs again.
      // If we are just typing, React reconciles and this effect doesn't run, which is good.
      // However, if we lose focus, this won't help us regain it unless we track it.
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Critical: Stop propagation to prevent global spreadsheet navigation/shortcuts
    // while editing. e.g. "ArrowRight" should move cursor in text, not change cell selection.
    e.stopPropagation(); 
    
    // We can allow some keys to bubble if strictly necessary, but usually
    // CellEditor should handle its own navigation logic or commit on specific keys.
    
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent newline if it's a single line input
      onCommit();
    } else if (e.key === 'Escape') {
      // e.preventDefault(); // Optional, usually good to prevent browser dialogs?
      onCancel();
    } else if (e.key === 'Tab') {
       // Tab usually commits and moves to next cell.
       // We can handle it here or let it bubble if we trust the parent.
       // But parent `useKeyboardNavigation` might prevent default.
       // Safest is to handle it explicitly if we want "Excel-like" behavior: Commit + Move.
       // For now, let's commit. The parent (Spreadsheet) logic for "Move on Commit" 
       // might not strictly exist yet, so we'll rely on global listener if we bubble?
       // userKeyboardNavigation.ts listens to window. 
       // If we stopPropagation, window won't see Tab.
       // So we MUST NOT stop propagation for Tab if we want global nav to pick it up.
       // OR we call a specific onTab handler.
       // Let's try bubbling Tab for now, but stop everything else.
       // Undo stopPropagation for Tab?
    }
  };

  return (
    <input
      ref={inputRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
        border: '2px solid #1a73e8',
        outline: 'none',
        padding: '0 4px',
        fontSize: '13px',
        fontFamily: 'Arial',
        zIndex: 100,
        boxSizing: 'border-box'
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
          if (e.key === 'Tab') {
              // Allow Tab to bubble to trigger navigation in useKeyboardNavigation
              // But ensure we commit first? useKeyboardNavigation commits on Tab if isEditingRef is true.
              // So we just let it bubble.
              return;
          }
          handleKeyDown(e);
      }}
      onBlur={onCommit}
    />
  );
}
