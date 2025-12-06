'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AIAssistant.module.css'; // Reusing styles for now for consistency

interface SmartAutocompleteProps {
  visible: boolean;
  position: { x: number; y: number };
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function SmartAutocomplete({
  visible,
  position,
  value,
  onSelect,
  onClose,
}: SmartAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Mock suggestion logic
  useEffect(() => {
    if (!value || !visible) return;

    if (value.startsWith('=')) {
      // Formula suggestions
      const query = value.slice(1).toUpperCase();
      const formulas = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'VLOOKUP'];
      setSuggestions(formulas.filter(f => f.startsWith(query)));
    } else {
      // Value autocompletion (mock)
      setSuggestions([]); // In real app, check column values
    }
    setSelectedIndex(0);
  }, [value, visible]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault();
          onSelect(value.startsWith('=') ? `=${suggestions[selectedIndex]}()` : suggestions[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, suggestions, selectedIndex, value, onSelect]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y + 24,
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 1000,
        minWidth: '200px',
        maxHeight: '200px',
        overflowY: 'auto',
      }}
    >
      {suggestions.map((item, index) => (
        <div
          key={item}
          onClick={() => onSelect(value.startsWith('=') ? `=${item}()` : item)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            background: index === selectedIndex ? '#f1f3f4' : 'white',
            borderBottom: '1px solid #f8f8f8',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 500 }}>{item}</span>
          <span style={{ fontSize: '10px', color: '#888' }}>함수</span>
        </div>
      ))}
    </div>
  );
}
