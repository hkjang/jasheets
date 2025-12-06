'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Spreadsheet {
  id: string;
  name: string;
  owner: { email: string; name: string | null };
  updatedAt: string;
  _count: { sheets: number };
}

export function SpreadsheetList() {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpreadsheets();
  }, []);

  const loadSpreadsheets = async () => {
    try {
      const data = await api.spreadsheets.listAdmin();
      setSpreadsheets(data);
    } catch (error) {
      alert('Failed to load spreadsheets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this spreadsheet?')) return;
    try {
      await api.spreadsheets.deleteAdmin(id);
      loadSpreadsheets();
    } catch (error) {
      alert('Failed to delete spreadsheet');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>All Spreadsheets</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Owner</th>
            <th style={{ padding: '8px' }}>Sheets</th>
            <th style={{ padding: '8px' }}>Last Updated</th>
            <th style={{ padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {spreadsheets.map((sheet) => (
            <tr key={sheet.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{sheet.name}</td>
              <td style={{ padding: '8px' }}>{sheet.owner.email}</td>
              <td style={{ padding: '8px' }}>{sheet._count.sheets}</td>
              <td style={{ padding: '8px' }}>{new Date(sheet.updatedAt).toLocaleDateString()}</td>
              <td style={{ padding: '8px' }}>
                <button
                  onClick={() => handleDelete(sheet.id)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
