'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import FlowEditor, { FlowNode, FlowEdge } from '@/components/flows/FlowEditor';
import { api } from '@/lib/api';
import styles from './page.module.css';

interface Flow {
  id: string;
  name: string;
  description?: string;
  spreadsheetId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  active: boolean;
  version: number;
}

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExecutions, setShowExecutions] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);

  // Load flow data
  useEffect(() => {
    if (flowId && flowId !== 'new') {
      loadFlow();
    } else {
      setLoading(false);
    }
  }, [flowId]);

  const loadFlow = async () => {
    try {
      const data = await api.flows.get(flowId);
      setFlow(data);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err) {
      setError('Failed to load flow');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((newNodes: FlowNode[], newEdges: FlowEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (flow) {
        await api.flows.update(flowId, { nodes, edges });
      }
      // Show success feedback
    } catch (err) {
      setError('Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    try {
      const result = await api.flows.execute(flowId, { test: true });
      alert(`Flow execution started! Transaction ID: ${result.transactionId}`);
      loadExecutions();
    } catch (err) {
      setError('Failed to execute flow');
    }
  };

  const loadExecutions = async () => {
    try {
      const data = await api.flows.getExecutions(flowId);
      setExecutions(data);
      setShowExecutions(true);
    } catch (err) {
      console.error('Failed to load executions');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        Loading flow...
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <span>⚠️</span>
        {error}
        <button onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => router.back()}>
          ← Back
        </button>
        <h1 className={styles.title}>
          {flow?.name || 'New Flow'}
        </h1>
        <div className={styles.headerActions}>
          <button
            className={styles.executeButton}
            onClick={handleExecute}
            disabled={!flow}
          >
            ▶️ Test Run
          </button>
          <button
            className={styles.historyButton}
            onClick={loadExecutions}
          >
            📜 Executions
          </button>
          <span className={saving ? styles.savingBadge : styles.savedBadge}>
            {saving ? 'Saving...' : 'Saved'}
          </span>
        </div>
      </header>

      {/* Flow Editor */}
      <div className={styles.editorContainer}>
        <FlowEditor
          nodes={nodes}
          edges={edges}
          onChange={handleChange}
          onSave={handleSave}
          spreadsheetId={flow?.spreadsheetId}
        />
      </div>

      {/* Executions Panel */}
      {showExecutions && (
        <div className={styles.executionsPanel}>
          <div className={styles.panelHeader}>
            <h3>Execution History</h3>
            <button onClick={() => setShowExecutions(false)}>✕</button>
          </div>
          <div className={styles.executionsList}>
            {executions.length === 0 ? (
              <p className={styles.noExecutions}>No executions yet</p>
            ) : (
              executions.map((exec) => (
                <div
                  key={exec.id}
                  className={`${styles.executionItem} ${styles[exec.status.toLowerCase()]}`}
                >
                  <div className={styles.executionHeader}>
                    <span className={styles.executionStatus}>
                      {exec.status === 'COMPLETED' ? '✅' : exec.status === 'FAILED' ? '❌' : '⏳'}
                      {exec.status}
                    </span>
                    <span className={styles.executionTime}>
                      {new Date(exec.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.executionId}>
                    TX: {exec.transactionId.substring(0, 8)}...
                  </div>
                  {exec.error && (
                    <div className={styles.executionError}>{exec.error}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
