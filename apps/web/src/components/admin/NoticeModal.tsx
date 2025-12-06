'use client';

import { useState, useEffect } from 'react';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
}

export function NoticeModal({ isOpen, onClose, onSubmit, initialData, title }: NoticeModalProps) {
  const [titleText, setTitleText] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('INFO');
  const [active, setActive] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitleText(initialData.title || '');
      setContent(initialData.content || '');
      setType(initialData.type || 'INFO');
      setActive(initialData.active ?? true);
      setEndDate(initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '');
    } else {
      setTitleText('');
      setContent('');
      setType('INFO');
      setActive(true);
      setEndDate('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ 
          title: titleText, 
          content,
          type,
          active,
          endDate: endDate ? new Date(endDate) : null // or ISO string? Backend expects Date object or ISO string. Prisma client handles Date.
      });
      onClose();
    } catch (e) {
      alert('Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b' }}>{title}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Title</label>
            <input 
              type="text" 
              required 
              value={titleText}
              onChange={e => setTitleText(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Content</label>
            <textarea 
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', minHeight: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Type</label>
                <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white' }}
                >
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="URGENT">Urgent</option>
                    <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>End Date (Optional)</label>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
          </div>
          
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              checked={active}
              onChange={e => setActive(e.target.checked)}
              id="active"
            />
            <label htmlFor="active" style={{ fontSize: '0.9rem', color: '#64748b' }}>Active</label>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
