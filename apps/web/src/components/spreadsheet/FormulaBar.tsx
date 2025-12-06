'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { CellPosition, cellRefToString } from '@/types/spreadsheet';
import styles from './FormulaBar.module.css';

interface FormulaBarProps {
  selectedCell: CellPosition | null;
  value: string;
  formula: string | null;
  isEditing: boolean;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: () => void;
}

export default function FormulaBar({
  selectedCell,
  value,
  formula,
  isEditing,
  onValueChange,
  onSubmit,
  onCancel,
  onEdit,
}: FormulaBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(formula || value);
  }, [value, formula]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onValueChange(localValue);
      onSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(formula || value);
      onCancel();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    onValueChange(localValue);
    onSubmit();
  };

  const cellRef = selectedCell ? cellRefToString(selectedCell.row, selectedCell.col) : '';

  return (
    <div className={styles.container}>
      <div className={styles.cellRef}>
        {cellRef}
      </div>
      <div className={styles.separator} />
      <div className={styles.functionIcon}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M4.5 6.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-.75v9h.75a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75v-10.5z"/>
          <path d="M9 10.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75z"/>
          <path d="M9.75 13.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5z"/>
          <path d="M18 6h1.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H18a.75.75 0 0 1 0-1.5h.75v-9H18a.75.75 0 0 1 0-1.5z"/>
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={onEdit}
        placeholder="Enter value or formula"
        readOnly={!isEditing}
      />
    </div>
  );
}
