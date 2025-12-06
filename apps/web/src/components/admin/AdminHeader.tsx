'use client';

import { useAuth } from '@/hooks/useAuth';

export function AdminHeader({ title }: { title: string }) {
  const { user, logout } = useAuth();

  return (
    <header style={{
      height: '64px',
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>{title}</h1>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={`https://ui-avatars.com/api/?name=${user?.name || 'Admin'}`} 
            alt="Profile" 
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          />
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user?.name}</span>
        </div>
        <button 
          onClick={logout}
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            color: '#ef4444',
            background: '#fee2e2',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
