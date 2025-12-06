'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataGrid } from './DataGrid';
import { TemplateModal } from './TemplateModal';

export function TemplateList() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const fetchTemplates = async () => {
    try {
      const data = await api.templates.list();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await api.templates.delete(id);
      fetchTemplates();
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingTemplate) {
      await api.templates.update(editingTemplate.id, data);
    } else {
      await api.templates.create(data);
    }
    fetchTemplates();
  };

  const columns = [
    { field: 'name', headerName: 'Name', width: '25%' },
    { field: 'category', headerName: 'Category', width: '20%' },
    { 
        field: 'isPublic', 
        headerName: 'Visibility', 
        width: '15%',
        renderCell: (row: any) => (
            <span style={{ color: row.isPublic ? '#15803d' : '#94a3b8', fontWeight: 500 }}>
                {row.isPublic ? 'Public' : 'Internal'}
            </span>
        )
    },
    { 
        field: 'description', 
        headerName: 'Description', 
        width: '25%',
        renderCell: (row: any) => (
            <span style={{ color: '#64748b', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {row.description}
            </span>
        )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: '15%',
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
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Templates</h2>
        <button 
          onClick={handleCreate}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
        >
          + Add Template
        </button>
      </div>

      <DataGrid rows={templates} columns={columns} loading={loading} />

      <TemplateModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSubmit={handleSave}
        initialData={editingTemplate}
        title={editingTemplate ? 'Edit Template' : 'Create New Template'}
      />
    </div>
  );
}
