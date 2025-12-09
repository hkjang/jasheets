'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const menuItems = [
    { label: '대시보드', href: '/admin', icon: '📊' },
    { label: '사용자 관리', href: '/admin/users', icon: '👥' },
    { label: '역할 및 권한', href: '/admin/roles', icon: '🔐' },
    { label: '스프레드시트', href: '/admin/spreadsheets', icon: '📑' },
    { label: '템플릿', href: '/admin/templates', icon: '📋' },
    { label: '공지사항', href: '/admin/notices', icon: '📢' },
    { label: '감사 로그', href: '/admin/audit', icon: '🔍' },
    { label: '설정', href: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <aside style={{
      width: '240px',
      background: 'white',
      borderRight: '1px solid #e5e7eb',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 16px', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: '14px'
        }}>J</div>
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>JaSheets</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>관리자</div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                margin: '2px 0',
                color: isActive ? '#1d4ed8' : '#374151',
                background: isActive ? '#eff6ff' : 'transparent',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ marginRight: '10px', fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
        <Link 
          href="/dashboard" 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            color: '#6b7280', 
            textDecoration: 'none', 
            fontSize: '14px',
            borderRadius: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ marginRight: '10px' }}>←</span>
          앱으로 돌아가기
        </Link>
        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '10px 12px',
            marginTop: '4px',
            color: '#dc2626',
            background: '#fef2f2',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ marginRight: '10px' }}>🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  );
}
