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
    }
  }, []);

  return (
    <input
      ref={inputRef}
      autoFocus
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
        // Stop propagation to prevent global keyboard navigation (which listens on window)
        // from interfering with editing (e.g. interpreting characters as commands or restarting edit)
        // Exception: Tab key might be needed for navigation, but for now we block all to ensure stability
        // or we can allow specific keys if needed. 
        // Given the bug "only last character saved", blocking everything is safest for data entry.
        // We let Enter/Escape bubble? No, CellEditor handles them. 
        // But if useKeyboardNavigation handles Enter to move down? 
        // Let's stop propagation for everything first.
        
        if (['Tab'].includes(e.key)) {
             // Let Tab bubble so useKeyboardNavigation can handle 'move next'
             // BUT, if isEditingRef is broken, Tab might be mishandled? 
             // useKeyboardNavigation handles Tab specifically.
             // allow bubbling for Tab.
        } else {
             e.stopPropagation();
        }

        if (e.key === 'Enter') {
          onCommit();
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={onCommit}
    />
  );
}
