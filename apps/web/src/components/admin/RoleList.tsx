'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataGrid } from './DataGrid';
import { RoleModal } from './RoleModal';

export function RoleList() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const fetchRoles = async () => {
    try {
      const data = await api.roles.list();
      setRoles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this role?')) {
      await api.roles.delete(id);
      fetchRoles();
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const handleEdit = (role: any) => {
    setEditingRole(role);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingRole) {
      await api.roles.update(editingRole.id, data);
    } else {
      await api.roles.create(data);
    }
    fetchRoles();
  };

  const columns = [
    { field: 'name', headerName: 'Name', width: '25%' },
    { field: 'description', headerName: 'Description', width: '35%' },
    { 
      field: 'isSystem', 
      headerName: 'Type', 
      width: '15%',
      renderCell: (row: any) => (
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '12px', 
          fontSize: '0.75rem', 
          background: row.isSystem ? '#f3e8ff' : '#f1f5f9',
          color: row.isSystem ? '#7e22ce' : '#475569',
          fontWeight: 600
        }}>
          {row.isSystem ? 'SYSTEM' : 'CUSTOM'}
        </span>
      )
    },
    {
        field: '_count',
        headerName: 'Users',
        width: '10%',
        renderCell: (row: any) => row._count?.users || 0
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
          {!row.isSystem && (
            <button 
                onClick={() => handleDelete(row.id)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c' }}
            >
                Delete
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Roles</h2>
        <button 
          onClick={handleCreate}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
        >
          + Add Role
        </button>
      </div>

      <DataGrid rows={roles} columns={columns} loading={loading} />

      <RoleModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSubmit={handleSave}
        initialData={editingRole}
        title={editingRole ? 'Edit Role' : 'Create New Role'}
      />
    </div>
  );
}
