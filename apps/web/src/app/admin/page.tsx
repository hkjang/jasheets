'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { api } from '../../lib/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ users: 0, spreadsheets: 0 });

  useEffect(() => {
    // Quick and dirty stats fetching
    Promise.all([
      api.users.list(),
      api.spreadsheets.listAdmin()
    ]).then(([users, sheets]) => {
      setStats({
        users: users.length,
        spreadsheets: sheets.length
      });
    }).catch(console.error);
  }, []);

  return (
    <>
      <AdminHeader title="Dashboard" />
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>Total Users</h3>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#1e293b' }}>{stats.users}</p>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>Total Spreadsheets</h3>
            <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#1e293b' }}>{stats.spreadsheets}</p>
          </div>

        </div>
      </div>
    </>
  );
}
