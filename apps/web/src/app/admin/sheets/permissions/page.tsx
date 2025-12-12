'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from './page.module.css';

interface PermissionPolicy {
    id: string;
    name: string;
    description?: string;
    rules: {
        canEdit: boolean;
        canComment: boolean;
        canShare: boolean;
        canExport: boolean;
        canDelete: boolean;
        canViewHistory: boolean;
        canManageAutomation: boolean;
        canUseAI: boolean;
    };
    isDefault: boolean;
    createdAt: string;
}

export default function PermissionsPage() {
    const [policies, setPolicies] = useState<PermissionPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<PermissionPolicy | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        rules: {
            canEdit: true,
            canComment: true,
            canShare: false,
            canExport: true,
            canDelete: false,
            canViewHistory: true,
            canManageAutomation: false,
            canUseAI: true,
        },
        isDefault: false,
    });

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const res = await fetch('/api/admin/permission-policies', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPolicies(data);
            }
        } catch (error) {
            console.error('Failed to fetch policies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingPolicy
                ? `/api/admin/permission-policies/${editingPolicy.id}`
                : '/api/admin/permission-policies';
            const method = editingPolicy ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                fetchPolicies();
                setShowForm(false);
                setEditingPolicy(null);
                resetForm();
            }
        } catch (error) {
            console.error('Failed to save policy:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/admin/permission-policies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });

            if (res.ok) {
                fetchPolicies();
            }
        } catch (error) {
            console.error('Failed to delete policy:', error);
        }
    };

    const handleEdit = (policy: PermissionPolicy) => {
        setEditingPolicy(policy);
        setFormData({
            name: policy.name,
            description: policy.description || '',
            rules: policy.rules,
            isDefault: policy.isDefault,
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            rules: {
                canEdit: true,
                canComment: true,
                canShare: false,
                canExport: true,
                canDelete: false,
                canViewHistory: true,
                canManageAutomation: false,
                canUseAI: true,
            },
            isDefault: false,
        });
    };

    const toggleRule = (key: keyof typeof formData.rules) => {
        setFormData(prev => ({
            ...prev,
            rules: { ...prev.rules, [key]: !prev.rules[key] },
        }));
    };

    return (
        <>
            <AdminHeader title="권한 정책 관리" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.header}>
                    <p className={styles.description}>시트별 권한 템플릿을 생성하고 관리합니다.</p>
                    <button className={styles.addButton} onClick={() => { setShowForm(true); setEditingPolicy(null); resetForm(); }}>
                        + 새 정책 추가
                    </button>
                </div>

                {showForm && (
                    <div className={styles.formCard}>
                        <h3>{editingPolicy ? '정책 수정' : '새 정책 추가'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label>정책 이름</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="예: 편집자 기본 권한"
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>설명</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="이 정책에 대한 설명"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>권한 설정</label>
                                <div className={styles.rulesGrid}>
                                    {Object.entries(formData.rules).map(([key, value]) => (
                                        <label key={key} className={styles.ruleItem}>
                                            <input
                                                type="checkbox"
                                                checked={value}
                                                onChange={() => toggleRule(key as keyof typeof formData.rules)}
                                            />
                                            <span>{getRuleLabel(key)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isDefault}
                                        onChange={e => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                                    />
                                    기본 정책으로 설정
                                </label>
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setShowForm(false)}>취소</button>
                                <button type="submit" className={styles.primary}>저장</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : policies.length === 0 ? (
                    <div className={styles.empty}>등록된 권한 정책이 없습니다.</div>
                ) : (
                    <div className={styles.table}>
                        <table>
                            <thead>
                                <tr>
                                    <th>이름</th>
                                    <th>설명</th>
                                    <th>권한</th>
                                    <th>기본</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {policies.map(policy => (
                                    <tr key={policy.id}>
                                        <td className={styles.nameCell}>{policy.name}</td>
                                        <td>{policy.description || '-'}</td>
                                        <td className={styles.rulesCell}>
                                            {Object.entries(policy.rules)
                                                .filter(([, v]) => v)
                                                .map(([k]) => getRuleLabel(k))
                                                .join(', ')}
                                        </td>
                                        <td>{policy.isDefault ? '✓' : ''}</td>
                                        <td>
                                            <button onClick={() => handleEdit(policy)}>수정</button>
                                            <button onClick={() => handleDelete(policy.id)} className={styles.deleteBtn}>삭제</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

function getRuleLabel(key: string): string {
    const labels: Record<string, string> = {
        canEdit: '편집',
        canComment: '댓글',
        canShare: '공유',
        canExport: '내보내기',
        canDelete: '삭제',
        canViewHistory: '기록 보기',
        canManageAutomation: '자동화 관리',
        canUseAI: 'AI 사용',
    };
    return labels[key] || key;
}
