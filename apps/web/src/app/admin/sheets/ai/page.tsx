'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../../components/admin/AdminHeader';
import styles from '../udf/page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';


interface AIModelConfig {
    id: string;
    name: string;
    modelType: string;
    provider: string;
    modelId: string;
    version: string;
    baseUrl?: string;
    apiKey?: string;
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

const MODEL_TYPES = ['FORMULA_SUGGEST', 'SHEET_GENERATE', 'DATA_ANALYSIS', 'CHAT_ASSISTANT'];
const PROVIDERS = ['OPENAI', 'GEMINI', 'ANTHROPIC', 'CUSTOM'];
const CATEGORIES = ['SHEET_CREATION', 'FORMULA_GENERATION', 'DATA_ANALYSIS', 'CHART_SUGGESTION', 'AUTOMATION', 'CUSTOM'];

export default function AISettingsPage() {
    const [models, setModels] = useState<AIModelConfig[]>([]);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'models' | 'templates'>('models');
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showModelModal, setShowModelModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

    // Form states
    const [modelForm, setModelForm] = useState({
        name: '', modelType: 'FORMULA_SUGGEST', provider: 'OPENAI', modelId: '', version: '1.0',
        baseUrl: '', apiKey: '', isActive: true, isDefault: false
    });
    const [templateForm, setTemplateForm] = useState({
        name: '', category: 'FORMULA_HELP', content: '', variables: '', description: '', isActive: true, isDefault: false
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const [modelsRes, templatesRes] = await Promise.all([
                fetch(`${API_URL}/admin/ai-configs`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/admin/prompt-templates`, { headers: { 'Authorization': `Bearer ${token}` } }),
            ]);

            if (modelsRes.ok) setModels(await modelsRes.json());
            if (templatesRes.ok) setTemplates(await templatesRes.json());
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Model CRUD
    const handleSaveModel = async () => {
        const token = localStorage.getItem('auth_token');
        const url = editingModel ? `${API_URL}/admin/ai-configs/${editingModel.id}` : `${API_URL}/admin/ai-configs`;
        const method = editingModel ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(modelForm),
            });
            if (res.ok) {
                fetchData();
                setShowModelModal(false);
                resetModelForm();
            }
        } catch (error) {
            console.error('Failed to save model:', error);
        }
    };

    const handleDeleteModel = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`${API_URL}/admin/ai-configs/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Failed to delete model:', error);
        }
    };

    const openEditModel = (model: AIModelConfig) => {
        setEditingModel(model);
        setModelForm({
            name: model.name, modelType: model.modelType, provider: model.provider,
            modelId: model.modelId, version: model.version, baseUrl: model.baseUrl || '',
            apiKey: model.apiKey || '', isActive: model.isActive, isDefault: model.isDefault
        });
        setShowModelModal(true);
    };

    const resetModelForm = () => {
        setEditingModel(null);
        setModelForm({ name: '', modelType: 'FORMULA_SUGGEST', provider: 'OPENAI', modelId: '', version: '1.0', baseUrl: '', apiKey: '', isActive: true, isDefault: false });
    };

    // Template CRUD
    const handleSaveTemplate = async () => {
        const token = localStorage.getItem('auth_token');
        const url = editingTemplate ? `${API_URL}/admin/prompt-templates/${editingTemplate.id}` : `${API_URL}/admin/prompt-templates`;
        const method = editingTemplate ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...templateForm,
                    variables: templateForm.variables.split(',').map(v => v.trim()).filter(Boolean),
                }),
            });
            if (res.ok) {
                fetchData();
                setShowTemplateModal(false);
                resetTemplateForm();
            }
        } catch (error) {
            console.error('Failed to save template:', error);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`${API_URL}/admin/prompt-templates/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Failed to delete template:', error);
        }
    };

    const openEditTemplate = (template: PromptTemplate) => {
        setEditingTemplate(template);
        setTemplateForm({
            name: template.name, category: template.category, content: template.content,
            variables: template.variables.join(', '), description: template.description || '',
            isActive: template.isActive, isDefault: template.isDefault
        });
        setShowTemplateModal(true);
    };

    const resetTemplateForm = () => {
        setEditingTemplate(null);
        setTemplateForm({ name: '', category: 'FORMULA_HELP', content: '', variables: '', description: '', isActive: true, isDefault: false });
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
                    <div style={{ flex: 1 }} />
                    <button
                        className={styles.approveBtn}
                        onClick={() => {
                            if (activeTab === 'models') {
                                resetModelForm();
                                setShowModelModal(true);
                            } else {
                                resetTemplateForm();
                                setShowTemplateModal(true);
                            }
                        }}
                    >
                        + {activeTab === 'models' ? '모델 추가' : '템플릿 추가'}
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
                                    <div className={styles.actions} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <button className={styles.approveBtn} onClick={() => openEditModel(model)}>수정</button>
                                        <button className={styles.rejectBtn} onClick={() => handleDeleteModel(model.id)}>삭제</button>
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
                                    <div className={styles.actions} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <button className={styles.approveBtn} onClick={() => openEditTemplate(template)}>수정</button>
                                        <button className={styles.rejectBtn} onClick={() => handleDeleteTemplate(template.id)}>삭제</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Model Modal */}
            {showModelModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModelModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2>{editingModel ? 'AI 모델 수정' : 'AI 모델 추가'}</h2>
                        <div className={styles.form}>
                            <label>이름</label>
                            <input value={modelForm.name} onChange={e => setModelForm({ ...modelForm, name: e.target.value })} />

                            <label>모델 타입</label>
                            <select value={modelForm.modelType} onChange={e => setModelForm({ ...modelForm, modelType: e.target.value })}>
                                {MODEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>

                            <label>제공자</label>
                            <select value={modelForm.provider} onChange={e => setModelForm({ ...modelForm, provider: e.target.value })}>
                                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>

                            {modelForm.provider === 'CUSTOM' && (
                                <>
                                    <label>API Base URL (OpenAI 호환)</label>
                                    <input
                                        value={modelForm.baseUrl}
                                        onChange={e => setModelForm({ ...modelForm, baseUrl: e.target.value })}
                                        placeholder="http://localhost:11434/v1 (Ollama) 또는 http://localhost:8000/v1 (vLLM)"
                                    />

                                    <label>API Key (선택사항)</label>
                                    <input
                                        type="password"
                                        value={modelForm.apiKey}
                                        onChange={e => setModelForm({ ...modelForm, apiKey: e.target.value })}
                                        placeholder="API 키가 필요한 경우 입력"
                                    />
                                </>
                            )}

                            <label>모델 ID</label>
                            <input value={modelForm.modelId} onChange={e => setModelForm({ ...modelForm, modelId: e.target.value })} placeholder={modelForm.provider === 'CUSTOM' ? "llama3, mistral, qwen2 등" : "gpt-4, claude-3 등"} />

                            <label>버전</label>
                            <input value={modelForm.version} onChange={e => setModelForm({ ...modelForm, version: e.target.value })} />

                            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={modelForm.isActive} onChange={e => setModelForm({ ...modelForm, isActive: e.target.checked })} /> 활성화
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={modelForm.isDefault} onChange={e => setModelForm({ ...modelForm, isDefault: e.target.checked })} /> 기본값
                                </label>
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.rejectBtn} onClick={() => setShowModelModal(false)}>취소</button>
                            <button className={styles.approveBtn} onClick={handleSaveModel}>저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Modal */}
            {showTemplateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowTemplateModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2>{editingTemplate ? '프롬프트 템플릿 수정' : '프롬프트 템플릿 추가'}</h2>
                        <div className={styles.form}>
                            <label>이름</label>
                            <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} />

                            <label>카테고리</label>
                            <select value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <label>설명</label>
                            <input value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} />

                            <label>프롬프트 내용</label>
                            <textarea
                                value={templateForm.content}
                                onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                                rows={5}
                                placeholder="{{variable}} 형식으로 변수 사용"
                            />

                            <label>변수 (쉼표로 구분)</label>
                            <input value={templateForm.variables} onChange={e => setTemplateForm({ ...templateForm, variables: e.target.value })} placeholder="formula, context, language" />

                            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={templateForm.isActive} onChange={e => setTemplateForm({ ...templateForm, isActive: e.target.checked })} /> 활성화
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="checkbox" checked={templateForm.isDefault} onChange={e => setTemplateForm({ ...templateForm, isDefault: e.target.checked })} /> 기본값
                                </label>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button className={styles.rejectBtn} onClick={() => setShowTemplateModal(false)}>취소</button>
                            <button className={styles.approveBtn} onClick={handleSaveTemplate}>저장</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
