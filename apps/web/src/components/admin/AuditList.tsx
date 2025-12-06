'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { DataGrid } from './DataGrid';

export function AuditList() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await api.audit.list();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    { 
        field: 'createdAt', 
        headerName: 'Date', 
        width: '20%',
        renderCell: (row: any) => new Date(row.createdAt).toLocaleString()
    },
    { 
        field: 'user', 
        headerName: 'User', 
        width: '20%',
        renderCell: (row: any) => row.user ? (row.user.name || row.user.email) : 'System'
    },
    { field: 'action', headerName: 'Action', width: '20%' },
    { field: 'resource', headerName: 'Resource', width: '20%' },
    { 
        field: 'details', 
        headerName: 'Details', 
        width: '20%',
        renderCell: (row: any) => (
            <span title={JSON.stringify(row.details, null, 2)} style={{ cursor: 'help' }}>
                {JSON.stringify(row.details).substring(0, 50) + (JSON.stringify(row.details).length > 50 ? '...' : '')}
            </span>
        )
    }
  ];

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '20px' }}>Audit Logs</h2>
      <DataGrid rows={logs} columns={columns} loading={loading} />
    </div>
  );
}
