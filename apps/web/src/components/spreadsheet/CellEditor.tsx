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
