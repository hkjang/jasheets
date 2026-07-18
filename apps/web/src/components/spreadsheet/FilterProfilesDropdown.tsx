'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { boundedFetch } from '@/lib/api-client';
import styles from './FilterProfilesDropdown.module.css';

export interface FilterProfile {
    id: string;
    name: string;
    filters: Array<{ column: number; operator: string; value: unknown }>;
    sortings?: Array<{ column: number; direction: 'asc' | 'desc' }>;
    hiddenRows?: number[];
    hiddenCols?: number[];
    isDefault: boolean;
    createdAt: string;
}

interface FilterProfilesDropdownProps {
    sheetId: string;
    onApplyProfile: (profile: FilterProfile) => void;
    onClearFilters: () => void;
    getProfileSnapshot?: () => Pick<FilterProfile, 'hiddenRows' | 'hiddenCols' | 'sortings'>;
}

export default function FilterProfilesDropdown({
    sheetId,
    onApplyProfile,
    onClearFilters,
    getProfileSnapshot,
}: FilterProfilesDropdownProps) {
    const [profiles, setProfiles] = useState<FilterProfile[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [newName, setNewName] = useState('');
    const [filterColumn, setFilterColumn] = useState('1');
    const [filterOperator, setFilterOperator] = useState('contains');
    const [filterValue, setFilterValue] = useState('');
    const [activeProfile, setActiveProfile] = useState<string | null>(null);
    const onApplyProfileRef = useRef(onApplyProfile);

    useEffect(() => {
        onApplyProfileRef.current = onApplyProfile;
    }, [onApplyProfile]);

    const fetchProfiles = useCallback(async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await boundedFetch(`/api/sheets/${sheetId}/filter-profiles`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
                const defaultProfile = data.find((p: FilterProfile) => p.isDefault);
                if (defaultProfile) {
                    setActiveProfile(defaultProfile.id);
                    onApplyProfileRef.current(defaultProfile);
                } else {
                    setActiveProfile(null);
                }
            }
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        }
    }, [sheetId]);

    useEffect(() => {
        if (sheetId) {
            // Loading a new sheet intentionally synchronizes remote profiles into local UI state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void fetchProfiles();
        }
    }, [fetchProfiles, sheetId]);

    const handleApply = (profile: FilterProfile) => {
        setActiveProfile(profile.id);
        onApplyProfile(profile);
        setIsOpen(false);
    };

    const handleClear = () => {
        setActiveProfile(null);
        onClearFilters();
        setIsOpen(false);
    };

    const handleSaveNew = async () => {
        if (!newName.trim()) return;

        const parsedColumn = Number.parseInt(filterColumn, 10) - 1;
        if (!Number.isInteger(parsedColumn) || parsedColumn < 0) return;

        const filters = filterOperator === 'isEmpty' || filterOperator === 'isNotEmpty'
            ? [{ column: parsedColumn, operator: filterOperator, value: '' }]
            : filterValue.trim()
                ? [{ column: parsedColumn, operator: filterOperator, value: filterValue }]
                : [];
        const snapshot = getProfileSnapshot?.() ?? {};

        try {
            const token = localStorage.getItem('auth_token');
            const response = await boundedFetch(`/api/sheets/${sheetId}/filter-profiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: newName.trim(),
                    filters,
                    ...snapshot,
                    isDefault: false,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to save filter profile (${response.status})`);
            }
            setNewName('');
            setFilterColumn('1');
            setFilterOperator('contains');
            setFilterValue('');
            setShowEditor(false);
            fetchProfiles();
        } catch (err) {
            console.error('Failed to save profile:', err);
        }
    };

    const handleSetDefault = async (profileId: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            await boundedFetch(`/api/sheets/${sheetId}/filter-profiles/${profileId}/set-default`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchProfiles();
        } catch (err) {
            console.error('Failed to set default:', err);
        }
    };

    const handleDelete = async (profileId: string) => {
        if (!confirm('이 필터 프로필을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('auth_token');
            await boundedFetch(`/api/sheets/${sheetId}/filter-profiles/${profileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (activeProfile === profileId) {
                setActiveProfile(null);
            }
            fetchProfiles();
        } catch (err) {
            console.error('Failed to delete profile:', err);
        }
    };

    return (
        <div className={styles.container}>
            <button
                className={`${styles.trigger} ${activeProfile ? styles.active : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles.icon}>📊</span>
                {activeProfile
                    ? profiles.find(p => p.id === activeProfile)?.name || '필터'
                    : '필터 프로필'}
                <span className={styles.arrow}>▼</span>
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <span>필터 프로필</span>
                        <button
                            className={styles.addBtn}
                            onClick={() => setShowEditor(!showEditor)}
                        >
                            +
                        </button>
                    </div>

                    {showEditor && (
                        <div className={styles.editor}>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="프로필 이름"
                                className={styles.input}
                            />
                            <div className={styles.filterRow}>
                                <label>
                                    열
                                    <input
                                        aria-label="필터 열"
                                        type="number"
                                        min="1"
                                        value={filterColumn}
                                        onChange={e => setFilterColumn(e.target.value)}
                                    />
                                </label>
                                <select
                                    aria-label="필터 연산자"
                                    value={filterOperator}
                                    onChange={e => setFilterOperator(e.target.value)}
                                >
                                    <option value="contains">포함</option>
                                    <option value="notContains">포함하지 않음</option>
                                    <option value="equals">같음</option>
                                    <option value="notEquals">같지 않음</option>
                                    <option value="greaterThan">초과</option>
                                    <option value="greaterThanOrEqual">이상</option>
                                    <option value="lessThan">미만</option>
                                    <option value="lessThanOrEqual">이하</option>
                                    <option value="isEmpty">비어 있음</option>
                                    <option value="isNotEmpty">비어 있지 않음</option>
                                </select>
                            </div>
                            {filterOperator !== 'isEmpty' && filterOperator !== 'isNotEmpty' && (
                                <input
                                    aria-label="필터 값"
                                    type="text"
                                    value={filterValue}
                                    onChange={e => setFilterValue(e.target.value)}
                                    placeholder="필터 값 (선택 사항)"
                                    className={styles.input}
                                />
                            )}
                            <button onClick={handleSaveNew} className={styles.saveBtn}>
                                저장
                            </button>
                        </div>
                    )}

                    <div className={styles.list}>
                        {profiles.length === 0 ? (
                            <div className={styles.empty}>저장된 프로필이 없습니다</div>
                        ) : (
                            profiles.map(profile => (
                                <div
                                    key={profile.id}
                                    className={`${styles.item} ${activeProfile === profile.id ? styles.active : ''}`}
                                >
                                    <div
                                        className={styles.itemName}
                                        onClick={() => handleApply(profile)}
                                    >
                                        {profile.name}
                                        {profile.isDefault && <span className={styles.defaultBadge}>기본</span>}
                                    </div>
                                    <div className={styles.itemActions}>
                                        {!profile.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(profile.id)}
                                                title="기본으로 설정"
                                            >
                                                ☆
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(profile.id)}
                                            title="삭제"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {activeProfile && (
                        <button onClick={handleClear} className={styles.clearBtn}>
                            필터 해제
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
