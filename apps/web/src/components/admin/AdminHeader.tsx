'use client';

import { useAuth } from '@/hooks/useAuth';

export function AdminHeader({ title }: { title: string }) {
  const { user } = useAuth();

  return (
    <header style={{
      height: '60px',
      background: 'white',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h1>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: '#f3f4f6',
          borderRadius: '20px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600
          }}>
            {(user?.name || user?.email || 'A')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            {user?.name || user?.email}
          </span>
        </div>
      </div>
    </header>
  );
}
