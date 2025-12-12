'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './CommandPalette.module.css';

interface Command {
    id: string;
    name: string;
    description?: string;
    shortcuts?: string[];
    isBuiltIn?: boolean;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    spreadsheetId: string;
    sheetId: string;
    onExecute: (commandName: string, result?: any) => void;
}

export default function CommandPalette({
    isOpen,
    onClose,
    spreadsheetId,
    sheetId,
    onExecute,
}: CommandPaletteProps) {
    const [commands, setCommands] = useState<Command[]>([]);
    const [builtInCommands, setBuiltInCommands] = useState<Command[]>([]);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCommands();
            fetchBuiltInCommands();
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, spreadsheetId]);

    const fetchCommands = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/spreadsheets/${spreadsheetId}/commands`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setCommands(data);
            }
        } catch (err) {
            console.error('Failed to fetch commands:', err);
        }
    };

    const fetchBuiltInCommands = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/spreadsheets/${spreadsheetId}/commands/built-in`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setBuiltInCommands(data.map((c: any) => ({ ...c, id: c.name, isBuiltIn: true })));
            }
        } catch (err) {
            console.error('Failed to fetch built-in commands:', err);
        }
    };

    const allCommands = [...commands, ...builtInCommands];
    const filteredCommands = allCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                }
                break;
            case 'Escape':
                onClose();
                break;
        }
    };

    const executeCommand = async (command: Command) => {
        try {
            const token = localStorage.getItem('token');

            if (command.isBuiltIn) {
                // Built-in commands are handled locally
                handleBuiltInCommand(command.name);
                onClose();
                return;
            }

            const res = await fetch(`/api/spreadsheets/${spreadsheetId}/commands/execute/${command.name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sheetId }),
            });

            if (res.ok) {
                const result = await res.json();
                onExecute(command.name, result);
            }
        } catch (err) {
            console.error('Failed to execute command:', err);
        }

        onClose();
    };

    const handleBuiltInCommand = (name: string) => {
        // Notify parent to handle built-in command
        onExecute(name);
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.palette} onClick={e => e.stopPropagation()}>
                <div className={styles.inputWrapper}>
                    <span className={styles.prompt}>&gt;</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="명령어 입력 또는 검색..."
                        className={styles.input}
                    />
                </div>

                <div className={styles.commands}>
                    {filteredCommands.length === 0 ? (
                        <div className={styles.empty}>일치하는 명령어가 없습니다</div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <div
                                key={cmd.id}
                                className={`${styles.command} ${index === selectedIndex ? styles.selected : ''}`}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className={styles.commandInfo}>
                                    <span className={styles.commandName}>{cmd.name}</span>
                                    {cmd.description && (
                                        <span className={styles.commandDesc}>{cmd.description}</span>
                                    )}
                                </div>
                                <div className={styles.commandMeta}>
                                    {cmd.isBuiltIn && (
                                        <span className={styles.builtInBadge}>내장</span>
                                    )}
                                    {cmd.shortcuts?.map((shortcut, i) => (
                                        <kbd key={i} className={styles.shortcut}>{shortcut}</kbd>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.footer}>
                    <span><kbd>↑</kbd><kbd>↓</kbd> 선택</span>
                    <span><kbd>Enter</kbd> 실행</span>
                    <span><kbd>Esc</kbd> 닫기</span>
                </div>
            </div>
        </div>
    );
}
