'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './FlowEditor.module.css';

// =====================================================
// Types
// =====================================================

export interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'transform' | 'http_request' | 'notification' | 'db_write' | 'end';
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

interface FlowEditorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onSave?: () => void;
  readonly?: boolean;
  spreadsheetId?: string; // Auto-injected from context
}

// Node type configurations with input/output port settings
const NODE_TYPES: { 
  [key: string]: { 
    label: string; 
    color: string; 
    icon: string;
    hasInput: boolean;  // Can receive connections
    hasOutput: boolean; // Can send connections
  } 
} = {
  trigger:      { label: 'Trigger',      color: '#d0ebff', icon: '⚡', hasInput: false, hasOutput: true  },
  condition:    { label: 'Condition',    color: '#e6fcf5', icon: '🔀', hasInput: true,  hasOutput: true  },
  transform:    { label: 'Transform',    color: '#fff3bf', icon: '🔄', hasInput: true,  hasOutput: true  },
  http_request: { label: 'HTTP Request', color: '#ffe3e3', icon: '🌐', hasInput: true,  hasOutput: true  },
  notification: { label: 'Notification', color: '#f3d9fa', icon: '📧', hasInput: true,  hasOutput: false },
  db_write:     { label: 'DB Write',     color: '#c5f6fa', icon: '💾', hasInput: true,  hasOutput: true  },
  end:          { label: 'End',          color: '#e9ecef', icon: '🏁', hasInput: true,  hasOutput: false },
};

// =====================================================
// FlowEditor Component
// =====================================================

export default function FlowEditor({ nodes, edges, onChange, onSave, readonly, spreadsheetId }: FlowEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; startX: number; startY: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // =====================================================
  // Node Operations
  // =====================================================

  const addNode = useCallback((type: FlowNode['type']) => {
    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: getDefaultNodeData(type, spreadsheetId),
    };
    onChange([...nodes, newNode], edges);
    setSelectedNode(newNode.id);
  }, [nodes, edges, onChange, spreadsheetId]);

  const updateNode = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
    onChange(
      nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
      edges
    );
  }, [nodes, edges, onChange]);

  const deleteNode = useCallback((nodeId: string) => {
    onChange(
      nodes.filter(n => n.id !== nodeId),
      edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNode(null);
  }, [nodes, edges, onChange]);

  // =====================================================
  // Edge Operations
  // =====================================================

  const addEdge = useCallback((source: string, target: string) => {
    // Prevent self-connections
    if (source === target) return;
    
    // Prevent duplicate connections
    if (edges.some(e => e.source === source && e.target === target)) return;
    
    // Validate source has output and target has input
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    if (!sourceNode || !targetNode) return;
    if (!NODE_TYPES[sourceNode.type].hasOutput) return;
    if (!NODE_TYPES[targetNode.type].hasInput) return;

    const newEdge: FlowEdge = {
      id: `edge_${Date.now()}`,
      source,
      target,
    };
    onChange(nodes, [...edges, newEdge]);
  }, [nodes, edges, onChange]);

  const deleteEdge = useCallback((edgeId: string) => {
    onChange(nodes, edges.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
  }, [nodes, edges, onChange]);

  // =====================================================
  // Drag & Drop Handlers
  // =====================================================

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (readonly) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    setMousePos({ x, y });

    if (dragging) {
      updateNode(dragging.nodeId, { 
        position: { 
          x: Math.max(0, x - dragging.offsetX), 
          y: Math.max(0, y - dragging.offsetY) 
        } 
      });
    }
  }, [dragging, pan, zoom, updateNode]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setConnecting(null);
  }, []);

  // =====================================================
  // Connection Handlers (Output port -> Input port)
  // =====================================================

  const handleOutputPortMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (readonly) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setConnecting({ 
      sourceId: nodeId, 
      startX: node.position.x + 180, // Right side of node
      startY: node.position.y + 30   // Middle of node
    });
  };

  const handleInputPortMouseUp = (e: React.MouseEvent, nodeId: string) => {
    if (readonly) return;
    e.stopPropagation();
    e.preventDefault();
    if (connecting && connecting.sourceId !== nodeId) {
      addEdge(connecting.sourceId, nodeId);
      setConnecting(null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    // If connecting, clicking on a node with input port connects to it
    if (connecting) {
      const targetNode = nodes.find(n => n.id === nodeId);
      if (targetNode && NODE_TYPES[targetNode.type].hasInput) {
        addEdge(connecting.sourceId, nodeId);
      }
      setConnecting(null);
    } else {
      setSelectedNode(nodeId);
      setSelectedEdge(null);
    }
  };

  const handleCanvasClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setConnecting(null);
  };

  // =====================================================
  // Keyboard Shortcuts
  // =====================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readonly) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) {
          e.preventDefault();
          deleteNode(selectedNode);
        } else if (selectedEdge) {
          e.preventDefault();
          deleteEdge(selectedEdge);
        }
      }
      if (e.key === 'Escape') {
        setConnecting(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge, deleteNode, deleteEdge, readonly]);

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Add Node:</span>
        {Object.entries(NODE_TYPES).map(([type, config]) => (
          <button
            key={type}
            className={styles.toolbarButton}
            onClick={() => addNode(type as FlowNode['type'])}
            title={config.label}
            disabled={readonly}
          >
            {config.icon} {config.label}
          </button>
        ))}
        <div className={styles.toolbarSpacer} />
        <div className={styles.zoomControls}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
        </div>
        {onSave && (
          <button className={styles.saveButton} onClick={onSave}>
            💾 Save
          </button>
        )}
      </div>

      {/* Connection mode indicator */}
      {connecting && (
        <div className={styles.connectionIndicator}>
          🔗 Connecting... Click on an input port (left side) or press ESC to cancel
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${connecting ? styles.canvasConnecting : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Edges */}
        <svg className={styles.edgesSvg}>
          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            // Source: right side of node (output port)
            const sourceX = sourceNode.position.x + 180;
            const sourceY = sourceNode.position.y + 35;
            // Target: left side of node (input port)
            const targetX = targetNode.position.x;
            const targetY = targetNode.position.y + 35;

            const midX = (sourceX + targetX) / 2;
            const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

            return (
              <g key={edge.id} onClick={(e) => { e.stopPropagation(); setSelectedEdge(edge.id); setSelectedNode(null); }}>
                <path
                  d={path}
                  className={`${styles.edge} ${selectedEdge === edge.id ? styles.edgeSelected : ''}`}
                />
                {/* Arrow head */}
                <polygon
                  points={`${targetX},${targetY} ${targetX - 8},${targetY - 5} ${targetX - 8},${targetY + 5}`}
                  className={styles.edgeArrow}
                />
                {edge.condition && (
                  <text x={midX} y={(sourceY + targetY) / 2 - 10} className={styles.edgeLabel}>
                    {edge.condition}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Connection preview line */}
          {connecting && (
            <path
              d={`M ${connecting.startX} ${connecting.startY} L ${mousePos.x} ${mousePos.y}`}
              className={styles.edgePreview}
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const config = NODE_TYPES[node.type];
          return (
            <div
              key={node.id}
              className={`${styles.node} ${selectedNode === node.id ? styles.nodeSelected : ''}`}
              style={{
                left: node.position.x,
                top: node.position.y,
                backgroundColor: config.color,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onClick={(e) => handleNodeClick(e, node.id)}
            >
              {/* Input port (left side) */}
              {config.hasInput && (
                <div
                  className={`${styles.port} ${styles.portInput} ${connecting ? styles.portActive : ''}`}
                  onMouseUp={(e) => handleInputPortMouseUp(e, node.id)}
                  title="Input - Drop here to connect"
                />
              )}
              
              <div className={styles.nodeContent}>
                <div className={styles.nodeHeader}>
                  <span className={styles.nodeIcon}>{config.icon}</span>
                  <span className={styles.nodeLabel}>{config.label}</span>
                </div>
                <div className={styles.nodeBody}>
                  {getNodeDisplayText(node)}
                </div>
              </div>
              
              {/* Output port (right side) */}
              {config.hasOutput && (
                <div
                  className={`${styles.port} ${styles.portOutput}`}
                  onMouseDown={(e) => handleOutputPortMouseDown(e, node.id)}
                  title="Output - Drag to connect"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Node Config Panel */}
      {selectedNode && !readonly && (
        <NodeConfigPanel
          node={nodes.find(n => n.id === selectedNode)!}
          onUpdate={(updates) => updateNode(selectedNode, updates)}
          onDelete={() => deleteNode(selectedNode)}
          spreadsheetId={spreadsheetId}
        />
      )}
    </div>
  );
}

// =====================================================
// Node Configuration Panel
// =====================================================

interface NodeConfigPanelProps {
  node: FlowNode;
  onUpdate: (updates: Partial<FlowNode>) => void;
  onDelete: () => void;
  spreadsheetId?: string;
}

function NodeConfigPanel({ node, onUpdate, onDelete, spreadsheetId }: NodeConfigPanelProps) {
  const updateData = (key: string, value: any) => {
    onUpdate({ data: { ...node.data, [key]: value } });
  };

  return (
    <div className={styles.configPanel}>
      <div className={styles.configHeader}>
        <span>{NODE_TYPES[node.type].icon} {NODE_TYPES[node.type].label}</span>
        <button className={styles.deleteButton} onClick={onDelete}>🗑️</button>
      </div>
      <div className={styles.configBody}>
        {node.type === 'trigger' && (
          <>
            <div className={styles.configInfo}>
              ⚡ Triggers when cells change in this spreadsheet
            </div>
            <label>Cell Range (optional)</label>
            <input
              type="text"
              value={node.data.cellRange || ''}
              onChange={(e) => updateData('cellRange', e.target.value)}
              placeholder="e.g., A1:B10 (leave empty for all cells)"
            />
            <label>Event Types</label>
            <select
              value={node.data.eventType || 'cell_change'}
              onChange={(e) => updateData('eventType', e.target.value)}
            >
              <option value="cell_change">Cell Change</option>
              <option value="row_insert">Row Insert</option>
              <option value="row_delete">Row Delete</option>
            </select>
          </>
        )}

        {node.type === 'condition' && (
          <>
            <label>Field</label>
            <input
              type="text"
              value={node.data.field || ''}
              onChange={(e) => updateData('field', e.target.value)}
              placeholder="e.g., newValue"
            />
            <label>Operator</label>
            <select
              value={node.data.operator || 'equals'}
              onChange={(e) => updateData('operator', e.target.value)}
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater Than</option>
              <option value="less_than">Less Than</option>
              <option value="is_empty">Is Empty</option>
              <option value="is_not_empty">Is Not Empty</option>
            </select>
            <label>Value</label>
            <input
              type="text"
              value={node.data.value || ''}
              onChange={(e) => updateData('value', e.target.value)}
              placeholder="Compare value"
            />
          </>
        )}

        {node.type === 'http_request' && (
          <>
            <label>URL</label>
            <input
              type="text"
              value={node.data.url || ''}
              onChange={(e) => updateData('url', e.target.value)}
              placeholder="https://api.example.com/endpoint"
            />
            <label>Method</label>
            <select
              value={node.data.method || 'POST'}
              onChange={(e) => updateData('method', e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <label>Headers (JSON)</label>
            <textarea
              value={node.data.headersJson || '{}'}
              onChange={(e) => updateData('headersJson', e.target.value)}
              placeholder='{"Authorization": "Bearer token"}'
            />
          </>
        )}

        {node.type === 'notification' && (
          <>
            <label>Channel</label>
            <select
              value={node.data.channel || 'email'}
              onChange={(e) => updateData('channel', e.target.value)}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
            </select>
            <label>Recipient</label>
            <input
              type="text"
              value={node.data.recipient || ''}
              onChange={(e) => updateData('recipient', e.target.value)}
              placeholder="Email or channel"
            />
            <label>Message Template</label>
            <textarea
              value={node.data.messageTemplate || ''}
              onChange={(e) => updateData('messageTemplate', e.target.value)}
              placeholder="Cell {{cellCoordinate}} changed to {{newValue}}"
            />
          </>
        )}

        {node.type === 'db_write' && (
          <>
            <label>Operation</label>
            <select
              value={node.data.operation || 'upsert'}
              onChange={(e) => updateData('operation', e.target.value)}
            >
              <option value="upsert">Upsert</option>
              <option value="update">Update</option>
            </select>
            <label>Target Sheet ID</label>
            <input
              type="text"
              value={node.data.targetSheetId || ''}
              onChange={(e) => updateData('targetSheetId', e.target.value)}
              placeholder="Sheet ID to write to"
            />
            <label>Target Cell</label>
            <input
              type="text"
              value={node.data.targetCell || ''}
              onChange={(e) => updateData('targetCell', e.target.value)}
              placeholder="e.g., A1"
            />
          </>
        )}

        {node.type === 'transform' && (
          <>
            <label>Transform Type</label>
            <select
              value={node.data.transformType || 'map'}
              onChange={(e) => updateData('transformType', e.target.value)}
            >
              <option value="map">Map Fields</option>
              <option value="filter">Filter</option>
              <option value="extract">Extract Field</option>
            </select>
            <label>Field</label>
            <input
              type="text"
              value={node.data.field || ''}
              onChange={(e) => updateData('field', e.target.value)}
              placeholder="Field path, e.g., data.value"
            />
            <label>Expression</label>
            <input
              type="text"
              value={node.data.expression || ''}
              onChange={(e) => updateData('expression', e.target.value)}
              placeholder="e.g., value * 2"
            />
          </>
        )}

        {node.type === 'end' && (
          <div className={styles.configInfo}>
            🏁 Flow ends here. All processing stops at this node.
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Helpers
// =====================================================

function getDefaultNodeData(type: FlowNode['type'], spreadsheetId?: string): Record<string, any> {
  switch (type) {
    case 'trigger':
      return { spreadsheetId, cellRange: '', eventType: 'cell_change' };
    case 'condition':
      return { field: 'newValue', operator: 'equals', value: '' };
    case 'transform':
      return { transformType: 'map', field: '', expression: '' };
    case 'http_request':
      return { url: '', method: 'POST', headersJson: '{}' };
    case 'notification':
      return { channel: 'email', recipient: '', messageTemplate: '' };
    case 'db_write':
      return { operation: 'upsert', targetSheetId: '', targetCell: '' };
    case 'end':
      return {};
    default:
      return {};
  }
}

function getNodeDisplayText(node: FlowNode): string {
  switch (node.type) {
    case 'trigger':
      return node.data.cellRange ? `Range: ${node.data.cellRange}` : 'All cells';
    case 'condition':
      return node.data.field ? `${node.data.field} ${node.data.operator} ${node.data.value}` : 'Configure...';
    case 'transform':
      return node.data.field || 'Configure...';
    case 'http_request':
      return node.data.url ? `${node.data.method} ${node.data.url.slice(0, 20)}...` : 'Configure...';
    case 'notification':
      return node.data.recipient || 'Configure...';
    case 'db_write':
      return node.data.targetCell || 'Configure...';
    case 'end':
      return 'Flow ends';
    default:
      return 'Configure...';
  }
}
