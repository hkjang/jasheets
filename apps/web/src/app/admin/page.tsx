'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserList } from '../../components/admin/UserList';
import { SpreadsheetList } from '../../components/admin/SpreadsheetList';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'spreadsheets'>('users');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      if (!user.isAdmin) {
        alert('Access denied');
        router.push('/');
        return;
      }
      setIsAdmin(true);
    } catch (e) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (loading) return <div>Checking access...</div>;
  if (!isAdmin) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', color: '#1a73e8' }}>Admin Dashboard</h1>
        <button 
          onClick={() => router.push('/')}
          style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Back to App
        </button>
      </header>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'users' ? '#1a73e8' : 'white',
            color: activeTab === 'users' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('spreadsheets')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'spreadsheets' ? '#1a73e8' : 'white',
            color: activeTab === 'spreadsheets' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Spreadsheets
        </button>
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {activeTab === 'users' ? <UserList /> : <SpreadsheetList />}
      </div>
    </div>
  );
}
