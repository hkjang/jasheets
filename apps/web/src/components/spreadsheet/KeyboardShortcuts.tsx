'use client';

import { useEffect } from 'react';
import styles from './KeyboardShortcuts.module.css';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'General', shortcuts: [
    { key: 'Ctrl + Z', description: 'Undo' },
    { key: 'Ctrl + Y', description: 'Redo' },
    { key: 'Ctrl + C', description: 'Copy' },
    { key: 'Ctrl + V', description: 'Paste' },
  ]},
  { category: 'Formatting', shortcuts: [
    { key: 'Ctrl + B', description: 'Bold' },
    { key: 'Ctrl + I', description: 'Italic' },
    { key: 'Ctrl + U', description: 'Underline' },
  ]},
  { category: 'Navigation', shortcuts: [
    { key: 'Arrow Keys', description: 'Move selection' },
    { key: 'Tab', description: 'Move right' },
    { key: 'Enter', description: 'Move down' },
  ]},
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.content}>
          {SHORTCUTS.map(category => (
            <div key={category.category} className={styles.category}>
              <h3>{category.category}</h3>
              <div className={styles.grid}>
                {category.shortcuts.map(shortcut => (
                  <div key={shortcut.key} className={styles.shortcut}>
                    <span className={styles.key}>{shortcut.key}</span>
                    <span className={styles.description}>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
