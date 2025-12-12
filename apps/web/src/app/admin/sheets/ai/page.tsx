'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from '../udf/page.module.css';

interface AIModelConfig {
    id: string;
    name: string;
    modelType: string;
    provider: string;
    modelId: string;
    version: string;
    isActive: boolean;
    isDefault: boolean;
    config?: Record<string, any>;
}

interface PromptTemplate {
    id: string;
    name: string;
    category: string;
    content: string;
    variables: string[];
    description?: string;
    isDefault: boolean;
    isActive: boolean;
}

export default function AISettingsPage() {
    const [models, setModels] = useState<AIModelConfig[]>([]);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'models' | 'templates'>('models');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [modelsRes, templatesRes] = await Promise.all([
                fetch('/api/admin/ai-configs', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
                fetch('/api/admin/prompt-templates', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                }),
            ]);

            if (modelsRes.ok) {
                const data = await modelsRes.json();
                setModels(data);
            }
            if (templatesRes.ok) {
                const data = await templatesRes.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AdminHeader title="AI 설정" backLink="/admin/sheets" />
            <div className={styles.container}>
                <div className={styles.filters}>
                    <button
                        className={`${styles.filterBtn} ${activeTab === 'models' ? styles.active : ''}`}
                        onClick={() => setActiveTab('models')}
                    >
                        AI 모델 ({models.length})
                    </button>
                    <button
                        className={`${styles.filterBtn} ${activeTab === 'templates' ? styles.active : ''}`}
                        onClick={() => setActiveTab('templates')}
                    >
                        프롬프트 템플릿 ({templates.length})
                    </button>
                </div>

                {loading ? (
                    <div className={styles.loading}>로딩 중...</div>
                ) : activeTab === 'models' ? (
                    <div className={styles.list}>
                        {models.length === 0 ? (
                            <div className={styles.empty}>등록된 AI 모델이 없습니다.</div>
                        ) : (
                            models.map(model => (
                                <div key={model.id} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3>{model.name}</h3>
                                        <div className={styles.badges}>
                                            <span className={`${styles.badge} ${model.isActive ? styles.statusApproved : styles.statusRejected}`}>
                                                {model.isActive ? '활성' : '비활성'}
                                            </span>
                                            {model.isDefault && (
                                                <span className={`${styles.badge} ${styles.statusApproved}`}>기본</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.cardMeta}>
                                        <span>타입: {model.modelType}</span>
                                        <span>제공자: {model.provider}</span>
                                        <span>모델: {model.modelId}</span>
                                        <span>버전: {model.version}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className={styles.list}>
                        {templates.length === 0 ? (
                            <div className={styles.empty}>등록된 프롬프트 템플릿이 없습니다.</div>
                        ) : (
                            templates.map(template => (
                                <div key={template.id} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h3>{template.name}</h3>
                                        <div className={styles.badges}>
                                            <span className={`${styles.badge} ${styles.riskLow}`}>{template.category}</span>
                                            {template.isDefault && (
                                                <span className={`${styles.badge} ${styles.statusApproved}`}>기본</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className={styles.cardDesc}>{template.description || '설명 없음'}</p>
                                    <div className={styles.cardMeta}>
                                        <span>변수: {template.variables.join(', ') || '없음'}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
