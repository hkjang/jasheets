'use client';

import { useState, useEffect } from 'react';
import styles from './SheetAutomationDialog.module.css';

interface Automation {
    id: string;
    name: string;
    description?: string;
    trigger: {
        eventType: string;
        conditions?: Array<{ field: string; operator: string; value: any }>;
    };
    actions: Array<{ type: string; config: Record<string, any> }>;
    active: boolean;
    runCount: number;
    lastRunAt?: string;
}

interface SheetAutomationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    sheetId: string;
}

export default function SheetAutomationDialog({
    isOpen,
    onClose,
    sheetId,
}: SheetAutomationDialogProps) {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

    // Editor state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [eventType, setEventType] = useState('CELL_CHANGE');
    const [actionType, setActionType] = useState('SET_VALUE');
    const [actionConfig, setActionConfig] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && sheetId) {
            fetchAutomations();
        }
    }, [isOpen, sheetId]);

    const fetchAutomations = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/sheets/${sheetId}/automations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAutomations(data);
            }
        } catch (err) {
            console.error('Failed to fetch automations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (automation: Automation) => {
        try {
            const token = localStorage.getItem('auth_token');
            await fetch(`/api/sheets/${sheetId}/automations/${automation.id}/toggle`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchAutomations();
        } catch (err) {
            console.error('Failed to toggle automation:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 자동화를 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('auth_token');
            await fetch(`/api/sheets/${sheetId}/automations/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchAutomations();
        } catch (err) {
            console.error('Failed to delete automation:', err);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            alert('이름을 입력하세요');
            return;
        }

        const automationData = {
            name,
            description,
            trigger: { eventType },
            actions: [{ type: actionType, config: actionConfig }],
        };

        try {
            const token = localStorage.getItem('auth_token');
            const url = editingAutomation
                ? `/api/sheets/${sheetId}/automations/${editingAutomation.id}`
                : `/api/sheets/${sheetId}/automations`;
            const method = editingAutomation ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(automationData),
            });

            if (res.ok) {
                resetEditor();
                fetchAutomations();
            }
        } catch (err) {
            console.error('Failed to save automation:', err);
        }
    };

    const resetEditor = () => {
        setShowEditor(false);
        setEditingAutomation(null);
        setName('');
        setDescription('');
        setEventType('CELL_CHANGE');
        setActionType('SET_VALUE');
        setActionConfig({});
    };

    const openEditor = (automation?: Automation) => {
        if (automation) {
            setEditingAutomation(automation);
            setName(automation.name);
            setDescription(automation.description || '');
            setEventType(automation.trigger.eventType);
            if (automation.actions[0]) {
                setActionType(automation.actions[0].type);
                setActionConfig(automation.actions[0].config as Record<string, string>);
            }
        }
        setShowEditor(true);
    };

    const getEventLabel = (event: string) => {
        const labels: Record<string, string> = {
            CELL_CHANGE: '셀 변경 시',
            ROW_INSERT: '행 추가 시',
            ROW_DELETE: '행 삭제 시',
            FORMULA_RECALC: '수식 재계산 시',
        };
        return labels[event] || event;
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            SET_VALUE: '셀 값 설정',
            COPY_VALUE: '값 복사',
            SEND_NOTIFICATION: '알림 전송',
            LOG: '로그 기록',
        };
        return labels[action] || action;
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{showEditor ? (editingAutomation ? '자동화 수정' : '새 자동화') : '시트 자동화'}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                {showEditor ? (
                    <div className={styles.editor}>
                        <div className={styles.field}>
                            <label>이름</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="자동화 이름"
                            />
                        </div>

                        <div className={styles.field}>
                            <label>설명</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="선택사항"
                            />
                        </div>

                        <div className={styles.field}>
                            <label>📌 트리거</label>
                            <select value={eventType} onChange={e => setEventType(e.target.value)}>
                                <option value="CELL_CHANGE">셀 변경 시</option>
                                <option value="ROW_INSERT">행 추가 시</option>
                                <option value="ROW_DELETE">행 삭제 시</option>
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label>⚡ 액션</label>
                            <select value={actionType} onChange={e => setActionType(e.target.value)}>
                                <option value="SET_VALUE">셀 값 설정</option>
                                <option value="COPY_VALUE">값 복사</option>
                                <option value="SEND_NOTIFICATION">알림 전송</option>
                                <option value="LOG">로그 기록</option>
                            </select>
                        </div>

                        {actionType === 'SET_VALUE' && (
                            <>
                                <div className={styles.field}>
                                    <label>대상 셀</label>
                                    <input
                                        type="text"
                                        value={actionConfig.targetCell || ''}
                                        onChange={e => setActionConfig({ ...actionConfig, targetCell: e.target.value })}
                                        placeholder="예: A1"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label>값</label>
                                    <input
                                        type="text"
                                        value={actionConfig.value || ''}
                                        onChange={e => setActionConfig({ ...actionConfig, value: e.target.value })}
                                        placeholder="설정할 값"
                                    />
                                </div>
                            </>
                        )}

                        {actionType === 'SEND_NOTIFICATION' && (
                            <div className={styles.field}>
                                <label>메시지</label>
                                <input
                                    type="text"
                                    value={actionConfig.message || ''}
                                    onChange={e => setActionConfig({ ...actionConfig, message: e.target.value })}
                                    placeholder="알림 메시지"
                                />
                            </div>
                        )}

                        <div className={styles.editorActions}>
                            <button onClick={resetEditor} className={styles.cancelButton}>
                                취소
                            </button>
                            <button onClick={handleSave} className={styles.saveButton}>
                                저장
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.content}>
                        <button onClick={() => openEditor()} className={styles.addButton}>
                            + 새 자동화 추가
                        </button>

                        <div className={styles.list}>
                            {loading ? (
                                <div className={styles.loading}>로딩 중...</div>
                            ) : automations.length === 0 ? (
                                <div className={styles.empty}>
                                    등록된 자동화가 없습니다.
                                    <br />
                                    <small>자동화를 추가하여 반복 작업을 줄이세요.</small>
                                </div>
                            ) : (
                                automations.map(automation => (
                                    <div key={automation.id} className={styles.item}>
                                        <div className={styles.itemHeader}>
                                            <label className={styles.toggle}>
                                                <input
                                                    type="checkbox"
                                                    checked={automation.active}
                                                    onChange={() => handleToggle(automation)}
                                                />
                                                <span className={styles.toggleSlider} />
                                            </label>
                                            <div className={styles.itemInfo}>
                                                <span className={styles.itemName}>{automation.name}</span>
                                                {automation.description && (
                                                    <span className={styles.itemDesc}>{automation.description}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.itemMeta}>
                                            <span className={styles.badge}>{getEventLabel(automation.trigger.eventType)}</span>
                                            <span className={styles.badge}>{getActionLabel(automation.actions[0]?.type)}</span>
                                            <span className={styles.runCount}>실행: {automation.runCount}회</span>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <button onClick={() => openEditor(automation)}>수정</button>
                                            <button onClick={() => handleDelete(automation.id)}>삭제</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
