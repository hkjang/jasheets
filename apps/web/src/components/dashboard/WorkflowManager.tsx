'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import styles from './WorkflowManager.module.css';

interface Flow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  maxRetries: number;
  createdAt: string;
}

interface EventRule {
  id: string;
  name: string;
  description?: string;
  targetType: string;
  eventTypes: string[];
  active: boolean;
}

interface FlowExecution {
  id: string;
  flowId: string;
  transactionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  triggerData?: any;
  startedAt: string;
  completedAt?: string;
  error?: string;
  flow?: { name: string };
}

interface WorkflowManagerProps {
  spreadsheetId: string;
}

export default function WorkflowManager({ spreadsheetId }: WorkflowManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'flows' | 'webhooks' | 'rules' | 'logs'>('flows');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [eventRules, setEventRules] = useState<EventRule[]>([]);
  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newWebhookData, setNewWebhookData] = useState({ name: '', url: '' });
  const [selectedExecution, setSelectedExecution] = useState<FlowExecution | null>(null);

  useEffect(() => {
    loadData();
  }, [spreadsheetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flowsData, webhooksData, rulesData] = await Promise.all([
        api.flows.list(spreadsheetId).catch(() => []),
        api.webhooks.list(spreadsheetId).catch(() => []),
        api.events.listRules(spreadsheetId).catch(() => []),
      ]);
      setFlows(flowsData);
      setWebhooks(webhooksData);
      setEventRules(rulesData);

      // Load executions for all flows
      if (flowsData.length > 0) {
        const allExecutions: FlowExecution[] = [];
        for (const flow of flowsData) {
          try {
            const execs = await api.flows.getExecutions(flow.id, 20);
            allExecutions.push(...execs.map((e: FlowExecution) => ({ ...e, flow: { name: flow.name } })));
          } catch { }
        }
        // Sort by startedAt descending
        allExecutions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setExecutions(allExecutions.slice(0, 50));
      }
    } catch (err) {
      setError('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  // Flow Actions
  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;
    try {
      const flow = await api.flows.create({
        spreadsheetId,
        name: newFlowName,
        nodes: [{ id: 'trigger_1', type: 'trigger', position: { x: 100, y: 100 }, data: {} }],
        edges: [],
      });
      setFlows([...flows, flow]);
      setShowCreateFlow(false);
      setNewFlowName('');
      router.push(`/flows/${flow.id}`);
    } catch (err) {
      setError('Failed to create flow');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    try {
      await api.flows.delete(flowId);
      setFlows(flows.filter(f => f.id !== flowId));
    } catch (err) {
      setError('Failed to delete flow');
    }
  };

  const handleToggleFlow = async (flowId: string, active: boolean) => {
    try {
      await api.flows.update(flowId, { active });
      setFlows(flows.map(f => f.id === flowId ? { ...f, active } : f));
    } catch (err) {
      setError('Failed to update flow');
    }
  };

  // Webhook Actions
  const handleCreateWebhook = async () => {
    if (!newWebhookData.name.trim() || !newWebhookData.url.trim()) return;
    try {
      const webhook = await api.webhooks.create({
        spreadsheetId,
        name: newWebhookData.name,
        url: newWebhookData.url,
        events: ['cell.update', 'sheet.create', 'sheet.delete'],
      });
      setWebhooks([...webhooks, webhook]);
      setShowCreateWebhook(false);
      setNewWebhookData({ name: '', url: '' });
    } catch (err) {
      setError('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await api.webhooks.delete(webhookId);
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
    } catch (err) {
      setError('Failed to delete webhook');
    }
  };

  const handleToggleWebhook = async (webhookId: string, active: boolean) => {
    try {
      await api.webhooks.update(webhookId, { active });
      setWebhooks(webhooks.map(w => w.id === webhookId ? { ...w, active } : w));
    } catch (err) {
      setError('Failed to update webhook');
    }
  };

  // Event Rule Actions
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this event rule?')) return;
    try {
      await api.events.deleteRule(ruleId);
      setEventRules(eventRules.filter(r => r.id !== ruleId));
    } catch (err) {
      setError('Failed to delete event rule');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        Loading workflows...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'flows' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('flows')}
        >
          ⚡ Flows ({flows.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'webhooks' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          🔗 Webhooks ({webhooks.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'rules' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 Event Rules ({eventRules.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📊 실행 로그 ({executions.length})
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Flows Tab */}
      {activeTab === 'flows' && (
        <div className={styles.content}>
          <div className={styles.header}>
            <h3>Automation Flows</h3>
            <button className={styles.createButton} onClick={() => setShowCreateFlow(true)}>
              + New Flow
            </button>
          </div>

          {flows.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⚡</span>
              <p>No flows yet</p>
              <button onClick={() => setShowCreateFlow(true)}>Create your first flow</button>
            </div>
          ) : (
            <div className={styles.list}>
              {flows.map(flow => (
                <div key={flow.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{flow.name}</span>
                    <span className={styles.itemMeta}>
                      Version {flow.version} • {flow.description || 'No description'}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={flow.active}
                        onChange={(e) => handleToggleFlow(flow.id, e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                    <button
                      className={styles.editButton}
                      onClick={() => router.push(`/flows/${flow.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteFlow(flow.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Flow Modal */}
          {showCreateFlow && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h4>Create New Flow</h4>
                <input
                  type="text"
                  placeholder="Flow name..."
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  autoFocus
                />
                <div className={styles.modalActions}>
                  <button onClick={() => setShowCreateFlow(false)}>Cancel</button>
                  <button className={styles.primary} onClick={handleCreateFlow}>
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className={styles.content}>
          <div className={styles.header}>
            <h3>Webhooks</h3>
            <button className={styles.createButton} onClick={() => setShowCreateWebhook(true)}>
              + New Webhook
            </button>
          </div>

          {webhooks.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔗</span>
              <p>No webhooks configured</p>
              <button onClick={() => setShowCreateWebhook(true)}>Add a webhook</button>
            </div>
          ) : (
            <div className={styles.list}>
              {webhooks.map(webhook => (
                <div key={webhook.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{webhook.name}</span>
                    <span className={styles.itemMeta}>
                      {webhook.url} • Events: {webhook.events.join(', ')}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={webhook.active}
                        onChange={(e) => handleToggleWebhook(webhook.id, e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Webhook Modal */}
          {showCreateWebhook && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h4>Create New Webhook</h4>
                <input
                  type="text"
                  placeholder="Webhook name..."
                  value={newWebhookData.name}
                  onChange={(e) => setNewWebhookData({ ...newWebhookData, name: e.target.value })}
                  autoFocus
                />
                <input
                  type="url"
                  placeholder="https://api.example.com/webhook"
                  value={newWebhookData.url}
                  onChange={(e) => setNewWebhookData({ ...newWebhookData, url: e.target.value })}
                />
                <div className={styles.modalActions}>
                  <button onClick={() => setShowCreateWebhook(false)}>Cancel</button>
                  <button className={styles.primary} onClick={handleCreateWebhook}>
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Rules Tab */}
      {activeTab === 'rules' && (
        <div className={styles.content}>
          <div className={styles.header}>
            <h3>Event Rules</h3>
          </div>

          {eventRules.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📋</span>
              <p>No event rules configured</p>
              <span className={styles.emptyHint}>Event rules are automatically created when you set up flows</span>
            </div>
          ) : (
            <div className={styles.list}>
              {eventRules.map(rule => (
                <div key={rule.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{rule.name}</span>
                    <span className={styles.itemMeta}>
                      {rule.targetType} • Events: {rule.eventTypes.join(', ')}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={rule.active ? styles.activeBadge : styles.inactiveBadge}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution Logs Tab */}
      {activeTab === 'logs' && (
        <div className={styles.content}>
          <div className={styles.header}>
            <h3>실행 로그</h3>
            <button className={styles.refreshButton} onClick={loadData}>
              🔄 새로고침
            </button>
          </div>

          {executions.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📊</span>
              <p>실행 로그가 없습니다</p>
              <span className={styles.emptyHint}>Flow가 트리거되면 여기에 기록됩니다</span>
            </div>
          ) : (
            <div className={styles.list}>
              {executions.map(exec => (
                <div key={exec.id} className={styles.logItem} onClick={() => setSelectedExecution(exec)}>
                  <div className={styles.logInfo}>
                    <span className={styles.logFlowName}>{exec.flow?.name || 'Unknown Flow'}</span>
                    <span className={styles.logTime}>
                      {new Date(exec.startedAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className={styles.logStatus}>
                    <span className={`${styles.statusBadge} ${styles[`status${exec.status}`]}`}>
                      {exec.status === 'COMPLETED' && '✓ 성공'}
                      {exec.status === 'FAILED' && '✕ 실패'}
                      {exec.status === 'RUNNING' && '⏳ 실행 중'}
                      {exec.status === 'PENDING' && '⏸ 대기'}
                      {exec.status === 'CANCELLED' && '⊘ 취소'}
                    </span>
                    {exec.completedAt && (
                      <span className={styles.logDuration}>
                        {Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Execution Detail Modal */}
          {selectedExecution && (
            <div className={styles.modal}>
              <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                <h4>실행 상세 정보</h4>
                <div className={styles.executionDetail}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Flow:</span>
                    <span>{selectedExecution.flow?.name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>상태:</span>
                    <span className={`${styles.statusBadge} ${styles[`status${selectedExecution.status}`]}`}>
                      {selectedExecution.status}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>시작:</span>
                    <span>{new Date(selectedExecution.startedAt).toLocaleString('ko-KR')}</span>
                  </div>
                  {selectedExecution.completedAt && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>완료:</span>
                      <span>{new Date(selectedExecution.completedAt).toLocaleString('ko-KR')}</span>
                    </div>
                  )}
                  {selectedExecution.error && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>오류:</span>
                      <span className={styles.errorText}>{selectedExecution.error}</span>
                    </div>
                  )}
                  {selectedExecution.triggerData && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>트리거 데이터:</span>
                      <pre className={styles.jsonData}>
                        {JSON.stringify(selectedExecution.triggerData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                <div className={styles.modalActions}>
                  <button onClick={() => setSelectedExecution(null)}>닫기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
