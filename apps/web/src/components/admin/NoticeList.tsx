'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataGrid } from './DataGrid';
import { NoticeModal } from './NoticeModal';

export function NoticeList() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<any>(null);

  const fetchNotices = async () => {
    try {
      const data = await api.notices.list();
      setNotices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this notice?')) {
      await api.notices.delete(id);
      fetchNotices();
    }
  };

  const handleCreate = () => {
    setEditingNotice(null);
    setModalOpen(true);
  };

  const handleEdit = (notice: any) => {
    setEditingNotice(notice);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingNotice) {
      await api.notices.update(editingNotice.id, data);
    } else {
      await api.notices.create(data);
    }
    fetchNotices();
  };

  const columns = [
    { field: 'title', headerName: 'Title', width: '30%' },
    { 
        field: 'type', 
        headerName: 'Type', 
        width: '15%',
        renderCell: (row: any) => (
            <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: row.type === 'URGENT' ? '#fee2e2' : row.type === 'WARNING' ? '#ffedd5' : row.type === 'MAINTENANCE' ? '#f3f4f6' : '#dbeafe',
                color: row.type === 'URGENT' ? '#b91c1c' : row.type === 'WARNING' ? '#c2410c' : row.type === 'MAINTENANCE' ? '#374151' : '#1e40af',
            }}>
                {row.type}
            </span>
        )
    },
    { 
        field: 'active', 
        headerName: 'Status', 
        width: '10%',
        renderCell: (row: any) => (
            <span style={{ color: row.active ? '#15803d' : '#94a3b8', fontWeight: 500 }}>
                {row.active ? 'Active' : 'Inactive'}
            </span>
        )
    },
    { 
        field: 'endDate', 
        headerName: 'End Date', 
        width: '20%',
        renderCell: (row: any) => row.endDate ? new Date(row.endDate).toLocaleDateString() : '-'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: '25%',
      renderCell: (row: any) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => handleEdit(row)}
            style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155' }}
          >
            Edit
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c' }}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>System Notices</h2>
        <button 
          onClick={handleCreate}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
        >
          + Add Notice
        </button>
      </div>

      <DataGrid rows={notices} columns={columns} loading={loading} />

      <NoticeModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSubmit={handleSave}
        initialData={editingNotice}
        title={editingNotice ? 'Edit Notice' : 'Create New Notice'}
      />
    </div>
  );
}
