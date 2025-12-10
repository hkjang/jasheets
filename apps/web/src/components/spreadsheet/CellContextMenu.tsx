'use client';

import React, { useEffect, useRef } from 'react';
import styles from './CellContextMenu.module.css';

interface CellContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onCut: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onInsertRowAbove: () => void;
    onInsertRowBelow: () => void;
    onInsertColLeft: () => void;
    onInsertColRight: () => void;
    onDeleteRow: () => void;
    onDeleteCol: () => void;
    onTableFormat: () => void;
    onConditionalFormat: () => void;
    hasSelection?: boolean;
}

export default function CellContextMenu({
    x,
    y,
    onClose,
    onCut,
    onCopy,
    onPaste,
    onInsertRowAbove,
    onInsertRowBelow,
    onInsertColLeft,
    onInsertColRight,
    onDeleteRow,
    onDeleteCol,
    onTableFormat,
    onConditionalFormat,
    hasSelection = false,
}: CellContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose();
        };

        // Listen to both mousedown and click for better UX
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    // Adjust position to keep menu in viewport
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            menuRef.current.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > viewportHeight) {
            menuRef.current.style.top = `${y - rect.height}px`;
        }
    }, [x, y]);

    const MenuItem = ({ label, onClick, shortcut, danger }: { label: string; onClick: () => void; shortcut?: string; danger?: boolean }) => (
        <button
            onClick={() => { onClick(); onClose(); }}
            className={`${styles.menuItem} ${danger ? styles.danger : ''}`}
        >
            <span>{label}</span>
            {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
        </button>
    );

    const Separator = () => <div className={styles.separator} />;

    return (
        <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: y, left: x }}
        >
            <MenuItem label="잘라내기" onClick={onCut} shortcut="Ctrl+X" />
            <MenuItem label="복사" onClick={onCopy} shortcut="Ctrl+C" />
            <MenuItem label="붙여넣기" onClick={onPaste} shortcut="Ctrl+V" />

            <Separator />

            <div className={styles.subMenuLabel}>행 삽입</div>
            <MenuItem label="위에 삽입" onClick={onInsertRowAbove} />
            <MenuItem label="아래에 삽입" onClick={onInsertRowBelow} />

            <div className={styles.subMenuLabel}>열 삽입</div>
            <MenuItem label="왼쪽에 삽입" onClick={onInsertColLeft} />
            <MenuItem label="오른쪽에 삽입" onClick={onInsertColRight} />

            <Separator />

            <div className={styles.subMenuLabel}>서식</div>
            <MenuItem label="테이블 서식 적용" onClick={onTableFormat} />
            <MenuItem label="조건부 서식" onClick={onConditionalFormat} />

            <Separator />

            <MenuItem label="행 삭제" onClick={onDeleteRow} danger />
            <MenuItem label="열 삭제" onClick={onDeleteCol} danger />
        </div>
    );
}
