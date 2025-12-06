'use client';

import { useState, useEffect } from 'react';

import { api } from '../../lib/api';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  title: string;
}

export function UserModal({ isOpen, onClose, onSubmit, initialData, title }: UserModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    const loadRoles = async () => {
        try {
            const data = await api.roles.list();
            setRoles(data);
        } catch (e) {
            console.error(e);
        }
    };
    if (isOpen) {
        loadRoles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setEmail(initialData.email || '');
      setName(initialData.name || '');
      setIsAdmin(initialData.isAdmin || false);
      setRoleId(initialData.roleId || '');
      setPassword(''); // Don't show password
    } else {
      setEmail('');
      setName('');
      setPassword('');
      setIsAdmin(false);
      setRoleId('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ 
          email, 
          name, 
          password: password || undefined, 
          isAdmin,
          roleId: roleId || null 
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
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b' }}>{title}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>
              Password {initialData && '(Leave blank to keep current)'}
            </label>
            <input 
              type="password" 
              required={!initialData}
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
          </div>
          
           <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: '#64748b' }}>Role</label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white' }}
            >
                <option value="">No specific role</option>
                {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              id="isAdmin"
            />
            <label htmlFor="isAdmin" style={{ fontSize: '0.9rem', color: '#64748b' }}>Is Super Admin (Overrides Role)</label>
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
