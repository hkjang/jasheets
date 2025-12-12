'use client';

import { useState, useEffect } from 'react';
import styles from './SheetPermissionsDialog.module.css';

interface SheetPermission {
    id: string;
    userId?: string;
    email?: string;
    role: 'VIEWER' | 'COMMENTER' | 'EDITOR';
    user?: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
    };
    createdAt: string;
}

interface SheetPermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    sheetId: string;
    sheetName: string;
}

export default function SheetPermissionsDialog({
    isOpen,
    onClose,
    sheetId,
    sheetName,
}: SheetPermissionsDialogProps) {
    const [permissions, setPermissions] = useState<SheetPermission[]>([]);
    const [loading, setLoading] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<'VIEWER' | 'COMMENTER' | 'EDITOR'>('VIEWER');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && sheetId) {
            fetchPermissions();
        }
    }, [isOpen, sheetId]);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/permissions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPermissions(data);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPermission = async () => {
        if (!newEmail.trim()) {
            setError('이메일을 입력하세요');
            return;
        }

        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sheets/${sheetId}/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ email: newEmail, role: newRole }),
            });

            if (res.ok) {
                setNewEmail('');
                fetchPermissions();
            } else {
                const data = await res.json();
                setError(data.message || '권한 추가에 실패했습니다');
            }
        } catch (err) {
            setError('권한 추가에 실패했습니다');
        }
    };

    const handleUpdateRole = async (permissionId: string, role: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/sheets/${sheetId}/permissions/${permissionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role }),
            });
            fetchPermissions();
        } catch (err) {
            console.error('Failed to update permission:', err);
        }
    };

    const handleRemovePermission = async (permissionId: string) => {
        if (!confirm('이 권한을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/sheets/${sheetId}/permissions/${permissionId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchPermissions();
        } catch (err) {
            console.error('Failed to remove permission:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>시트 권한 관리</h2>
                    <span className={styles.sheetName}>{sheetName}</span>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.addSection}>
                        <h3>사용자 추가</h3>
                        <div className={styles.addForm}>
                            <input
                                type="email"
                                placeholder="이메일 주소"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className={styles.emailInput}
                            />
                            <select
                                value={newRole}
                                onChange={e => setNewRole(e.target.value as any)}
                                className={styles.roleSelect}
                            >
                                <option value="VIEWER">뷰어</option>
                                <option value="COMMENTER">댓글 작성자</option>
                                <option value="EDITOR">편집자</option>
                            </select>
                            <button onClick={handleAddPermission} className={styles.addButton}>
                                추가
                            </button>
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                    </div>

                    <div className={styles.permissionsList}>
                        <h3>현재 권한</h3>
                        {loading ? (
                            <div className={styles.loading}>로딩 중...</div>
                        ) : permissions.length === 0 ? (
                            <div className={styles.empty}>
                                이 시트에 대한 개별 권한이 없습니다.
                                <br />
                                <small>스프레드시트 권한이 기본으로 적용됩니다.</small>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {permissions.map(perm => (
                                    <div key={perm.id} className={styles.permissionItem}>
                                        <div className={styles.userInfo}>
                                            {perm.user?.avatar ? (
                                                <img src={perm.user.avatar} alt="" className={styles.avatar} />
                                            ) : (
                                                <div className={styles.avatarPlaceholder}>
                                                    {(perm.user?.name || perm.email || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div className={styles.userDetails}>
                                                <span className={styles.userName}>
                                                    {perm.user?.name || perm.email}
                                                </span>
                                                {perm.user?.name && (
                                                    <span className={styles.userEmail}>{perm.user.email}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <select
                                                value={perm.role}
                                                onChange={e => handleUpdateRole(perm.id, e.target.value)}
                                                className={styles.roleSelect}
                                            >
                                                <option value="VIEWER">뷰어</option>
                                                <option value="COMMENTER">댓글 작성자</option>
                                                <option value="EDITOR">편집자</option>
                                            </select>
                                            <button
                                                onClick={() => handleRemovePermission(perm.id)}
                                                className={styles.removeButton}
                                                title="권한 삭제"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.info}>
                        <strong>알림:</strong> 시트 권한은 스프레드시트 권한보다 우선합니다.
                    </div>
                    <button onClick={onClose} className={styles.doneButton}>
                        완료
                    </button>
                </div>
            </div>
        </div>
    );
}
