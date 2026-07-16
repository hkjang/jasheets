'use client';

import { useState, useEffect } from 'react';
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
}

export default function FilterProfilesDropdown({
    sheetId,
    onApplyProfile,
    onClearFilters,
}: FilterProfilesDropdownProps) {
    const [profiles, setProfiles] = useState<FilterProfile[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [newName, setNewName] = useState('');
    const [activeProfile, setActiveProfile] = useState<string | null>(null);

    useEffect(() => {
        if (sheetId) {
            fetchProfiles();
        }
    }, [sheetId]);

    const fetchProfiles = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/sheets/${sheetId}/filter-profiles`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
                const defaultProfile = data.find((p: FilterProfile) => p.isDefault);
                if (defaultProfile) {
                    setActiveProfile(defaultProfile.id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        }
    };

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

        try {
            const token = localStorage.getItem('auth_token');
            await fetch(`/api/sheets/${sheetId}/filter-profiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: newName,
                    filters: [],
                    isDefault: false,
                }),
            });
            setNewName('');
            setShowEditor(false);
            fetchProfiles();
        } catch (err) {
            console.error('Failed to save profile:', err);
        }
    };

    const handleSetDefault = async (profileId: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            await fetch(`/api/sheets/${sheetId}/filter-profiles/${profileId}/set-default`, {
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
            await fetch(`/api/sheets/${sheetId}/filter-profiles/${profileId}`, {
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
