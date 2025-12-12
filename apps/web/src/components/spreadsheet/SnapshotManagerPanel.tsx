'use client';

import { useState, useEffect } from 'react';
import styles from './SnapshotManagerPanel.module.css';

interface Snapshot {
    id: string;
    name: string;
    description?: string;
    isBranch: boolean;
    parentId?: string;
    createdAt: string;
    createdBy: {
        id: string;
        name: string;
        avatar?: string;
    };
}

interface SnapshotManagerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sheetId: string;
    onRestore: () => void;
}

export default function SnapshotManagerPanel({
    isOpen,
    onClose,
    sheetId,
    onRestore,
}: SnapshotManagerPanelProps) {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
    const [compareResult, setCompareResult] = useState<any>(null);

    useEffect(() => {
        if (isOpen && sheetId) {
            fetchSnapshots();
        }
    }, [isOpen, sheetId]);

    const fetchSnapshots = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/snapshots`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSnapshots(data);
            }
        } catch (err) {
            console.error('Failed to fetch snapshots:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/snapshots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newName, description: newDesc }),
            });
            if (res.ok) {
                setNewName('');
                setNewDesc('');
                setShowCreate(false);
                fetchSnapshots();
            }
        } catch (err) {
            console.error('Failed to create snapshot:', err);
        }
    };

    const handleRestore = async (snapshotId: string) => {
        if (!confirm('이 스냅샷으로 복원하시겠습니까? 현재 데이터가 백업된 후 복원됩니다.')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/snapshots/${snapshotId}/restore`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                alert('복원이 완료되었습니다.');
                onRestore();
                fetchSnapshots();
            }
        } catch (err) {
            console.error('Failed to restore snapshot:', err);
        }
    };

    const handleDelete = async (snapshotId: string) => {
        if (!confirm('이 스냅샷을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/sheets/${sheetId}/snapshots/${snapshotId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSnapshots();
        } catch (err) {
            console.error('Failed to delete snapshot:', err);
        }
    };

    const toggleCompare = (id: string) => {
        if (selectedForCompare.includes(id)) {
            setSelectedForCompare(selectedForCompare.filter(s => s !== id));
        } else if (selectedForCompare.length < 2) {
            setSelectedForCompare([...selectedForCompare, id]);
        }
    };

    const handleCompare = async () => {
        if (selectedForCompare.length !== 2) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(
                `/api/sheets/${sheetId}/snapshots/${selectedForCompare[0]}/compare/${selectedForCompare[1]}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setCompareResult(data);
            }
        } catch (err) {
            console.error('Failed to compare:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!isOpen) return null;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h2>스냅샷</h2>
                <button className={styles.closeButton} onClick={onClose}>×</button>
            </div>

            <div className={styles.actions}>
                <button onClick={() => setShowCreate(!showCreate)} className={styles.createBtn}>
                    + 스냅샷 생성
                </button>
                {selectedForCompare.length === 2 && (
                    <button onClick={handleCompare} className={styles.compareBtn}>
                        비교하기
                    </button>
                )}
            </div>

            {showCreate && (
                <div className={styles.createForm}>
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="스냅샷 이름"
                        className={styles.input}
                    />
                    <input
                        type="text"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        placeholder="설명 (선택)"
                        className={styles.input}
                    />
                    <div className={styles.formActions}>
                        <button onClick={() => setShowCreate(false)}>취소</button>
                        <button onClick={handleCreate} className={styles.saveBtn}>생성</button>
                    </div>
                </div>
            )}

            {compareResult && (
                <div className={styles.compareResult}>
                    <div className={styles.compareHeader}>
                        <h3>비교 결과</h3>
                        <button onClick={() => setCompareResult(null)}>×</button>
                    </div>
                    <div className={styles.compareSummary}>{compareResult.summary}</div>
                    <div className={styles.compareStats}>
                        <span className={styles.added}>+{compareResult.added?.length || 0} 추가</span>
                        <span className={styles.removed}>-{compareResult.removed?.length || 0} 삭제</span>
                        <span className={styles.modified}>~{compareResult.modified?.length || 0} 수정</span>
                    </div>
                </div>
            )}

            <div className={styles.list}>
                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : snapshots.length === 0 ? (
                    <div className={styles.empty}>
                        저장된 스냅샷이 없습니다.
                        <br />
                        <small>스냅샷을 생성하여 시트 상태를 저장하세요.</small>
                    </div>
                ) : (
                    snapshots.map(snapshot => (
                        <div
                            key={snapshot.id}
                            className={`${styles.item} ${selectedForCompare.includes(snapshot.id) ? styles.selected : ''}`}
                        >
                            <div className={styles.itemCheck}>
                                <input
                                    type="checkbox"
                                    checked={selectedForCompare.includes(snapshot.id)}
                                    onChange={() => toggleCompare(snapshot.id)}
                                />
                            </div>
                            <div className={styles.itemContent}>
                                <div className={styles.itemName}>
                                    {snapshot.isBranch && <span className={styles.branchIcon}>⎇</span>}
                                    {snapshot.name}
                                </div>
                                {snapshot.description && (
                                    <div className={styles.itemDesc}>{snapshot.description}</div>
                                )}
                                <div className={styles.itemMeta}>
                                    <span>{formatDate(snapshot.createdAt)}</span>
                                    <span>by {snapshot.createdBy.name}</span>
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                <button onClick={() => handleRestore(snapshot.id)} title="복원">
                                    ↺
                                </button>
                                <button onClick={() => handleDelete(snapshot.id)} title="삭제">
                                    ×
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
