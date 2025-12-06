'use client';

import { useEffect, useState } from 'react';
import { colIndexToLetter } from '@/types/spreadsheet';
import styles from './UserCursors.module.css';

interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: {
    row: number;
    col: number;
  };
  selection?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
}

interface UserCursorsProps {
  users: UserPresence[];
  getCellPosition: (row: number, col: number) => { x: number; y: number; width: number; height: number } | null;
  scrollOffset: { x: number; y: number };
}

export default function UserCursors({ users, getCellPosition, scrollOffset }: UserCursorsProps) {
  // We can add logic to fade out labels if needed, but for now we keep it simple and premium
  
  return (
    <div className={styles.container}>
      {users.map((user) => {
        if (!user.cursor) return null;

        const pos = getCellPosition(user.cursor.row, user.cursor.col);
        if (!pos) return null;

        return (
          <div key={user.id} className={styles.cursorContainer}>
            {/* Selection highlight (rendered behind cursor) */}
            {user.selection && (
              <SelectionHighlight
                selection={user.selection}
                color={user.color}
                getCellPosition={getCellPosition}
                scrollOffset={scrollOffset}
              />
            )}
            
            {/* Main Cursor Box */}
            <div
              className={styles.cursor}
              style={{
                left: pos.x - scrollOffset.x,
                top: pos.y - scrollOffset.y,
                width: pos.width,
                height: pos.height,
                borderColor: user.color,
                // Pass color for animations if needed
                // '--cursor-color': user.color 
              } as React.CSSProperties}
            >
              {/* Name Label */}
              <div
                className={styles.label}
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SelectionHighlightProps {
  selection: UserPresence['selection'];
  color: string;
  getCellPosition: (row: number, col: number) => { x: number; y: number; width: number; height: number } | null;
  scrollOffset: { x: number; y: number };
}

function SelectionHighlight({ selection, color, getCellPosition, scrollOffset }: SelectionHighlightProps) {
  if (!selection) return null;

  const startPos = getCellPosition(selection.startRow, selection.startCol);
  const endPos = getCellPosition(selection.endRow, selection.endCol);

  if (!startPos || !endPos) return null;

  // Calculate bounding box in canvas coordinates
  const left = Math.min(startPos.x, endPos.x);
  const top = Math.min(startPos.y, endPos.y);
  
  // Calculate total width/height from the outer edges
  const right = Math.max(startPos.x + startPos.width, endPos.x + endPos.width);
  const bottom = Math.max(startPos.y + startPos.height, endPos.y + endPos.height);
  
  const width = right - left;
  const height = bottom - top;

  return (
    <div
      className={styles.selection}
      style={{
        left: left - scrollOffset.x,
        top: top - scrollOffset.y,
        width,
        height,
        backgroundColor: `${color}20`, // 12% opacity roughly
        borderColor: color,
      }}
    />
  );
}
