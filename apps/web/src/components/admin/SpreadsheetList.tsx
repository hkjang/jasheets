'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataGrid } from './DataGrid';

export function SpreadsheetList() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const data = showTrash ? await api.spreadsheets.listTrash() : await api.spreadsheets.listAdmin();
      setSheets(data);
    } catch (e) {
      console.error(e);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, [showTrash]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this spreadsheet?')) {
      await api.spreadsheets.deleteAdmin(id);
      fetchSheets();
    }
  };

  const handleRestore = async (id: string) => {
    try {
        await api.spreadsheets.restore(id);
        fetchSheets();
    } catch (e) {
        alert('Failed to restore');
    }
  };

  const handleHardDelete = async (id: string) => {
     if (confirm('Create PERMANENTLY delete this spreadsheet? This cannot be undone.')) {
        await api.spreadsheets.hardDelete(id);
        fetchSheets();
     }
  };

  const columns = [
    { field: 'name', headerName: 'Name', width: '30%' },
    { 
      field: 'owner', 
      headerName: 'Owner', 
      width: '20%',
      renderCell: (row: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.owner ? (
            <>
               <span style={{ fontSize: '0.9rem' }}>{row.owner.name || row.owner.email}</span>
            </>
          ) : 'Unknown'}
        </div>
      )
    },
    {
        field: 'deletedAt',
        headerName: 'Deleted At',
        width: '20%',
        renderCell: (row: any) => row.deletedAt ? new Date(row.deletedAt).toLocaleDateString() : '-'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: '30%',
      renderCell: (row: any) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          {!showTrash ? (
             <button 
                onClick={() => handleDelete(row.id)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c' }}
                >
                Delete
            </button>
          ) : (
             <>
                <button 
                    onClick={() => handleRestore(row.id)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '4px', color: '#166534' }}
                >
                    Restore
                </button>
                <button 
                    onClick={() => handleHardDelete(row.id)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c' }}
                >
                    Hard Delete
                </button>
             </>
          )}
         
        </div>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Spreadsheets</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button
                onClick={() => setShowTrash(false)}
                style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: !showTrash ? '#e2e8f0' : 'white',
                    color: !showTrash ? '#1e293b' : '#64748b',
                    cursor: 'pointer'
                }}
            >
                Active
            </button>
            <button
                onClick={() => setShowTrash(true)}
                style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: showTrash ? '#e2e8f0' : 'white',
                    color: showTrash ? '#1e293b' : '#64748b',
                    cursor: 'pointer'
                }}
            >
                Trash
            </button>
        </div>
      </div>
      <DataGrid rows={sheets} columns={columns} loading={loading} />
    </div>
  );
}
