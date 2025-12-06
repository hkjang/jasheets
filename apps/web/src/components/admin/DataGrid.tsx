'use client';

import React from 'react';

interface Column<T> {
  field: keyof T | string;
  headerName: string;
  width?: number | string;
  renderCell?: (row: T) => React.ReactNode;
}

interface DataGridProps<T> {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
}

export function DataGrid<T extends { id: string }>({ rows, columns, loading }: DataGridProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
        Loading data...
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      border: '1px solid #e2e8f0'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx}
                style={{ 
                  padding: '12px 24px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: col.width
                }}
              >
                {col.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr 
              key={row.id} 
              style={{ borderBottom: '1px solid #f1f5f9' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              {columns.map((col, idx) => (
                <td 
                  key={idx} 
                  style={{ 
                    padding: '16px 24px', 
                    fontSize: '0.9rem', 
                    color: '#334155' 
                  }}
                >
                  {col.renderCell ? col.renderCell(row) : (row as any)[col.field]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
