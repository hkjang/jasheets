'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { label: 'Users', href: '/admin/users', icon: 'people' },
    { label: 'Roles', href: '/admin/roles', icon: 'verified_user' },
    { label: 'Spreadsheets', href: '/admin/spreadsheets', icon: 'table_view' },
    { label: 'Templates', href: '/admin/templates', icon: 'library_books' },
    { label: 'Notices', href: '/admin/notices', icon: 'campaign' },
    { label: 'Audit Logs', href: '/admin/audit', icon: 'security' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings' },
  ];

  return (
    <aside style={{
      width: '250px',
      background: '#1e293b',
      color: 'white',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#60a5fa' }}>JaSheets Admin</h2>
      </div>
      
      <nav style={{ flex: 1, padding: '20px 0' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 20px',
                color: isActive ? '#60a5fa' : '#94a3b8',
                background: isActive ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <span className="material-icons" style={{ marginRight: '10px' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '20px', borderTop: '1px solid #334155' }}>
        <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
          <span className="material-icons" style={{ marginRight: '8px', fontSize: '1.1rem' }}>arrow_back</span>
          Back to App
        </Link>
      </div>
    </aside>
  );
}
