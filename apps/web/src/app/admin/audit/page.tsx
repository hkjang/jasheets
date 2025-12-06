'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { api } from '../../../lib/api';
import { DataGrid } from '../../../components/admin/DataGrid';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.audit.list()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { field: 'createdAt', headerName: 'Time', width: '20%', renderCell: (row: any) => new Date(row.createdAt).toLocaleString() },
    { field: 'user', headerName: 'User', width: '20%', renderCell: (row: any) => row.user ? row.user.email : 'System' },
    { field: 'action', headerName: 'Action', width: '20%' },
    { field: 'resource', headerName: 'Resource', width: '20%' },
    { field: 'details', headerName: 'Details', width: '20%', renderCell: (row: any) => JSON.stringify(row.details || {}) },
  ];

  return (
    <>
      <AdminHeader title="Audit Logs" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <DataGrid rows={logs} columns={columns} loading={loading} />
      </div>
    </>
  );
}
