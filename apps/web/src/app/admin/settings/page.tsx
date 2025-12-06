'use client';

import { useState, useEffect } from 'react';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { api } from '../../../lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string) => {
    const newValue = !settings[key]; // Toggle boolean-like value (stored as string "true"/"false" or just boolean in JSON in future)
    // For simplicity, we'll store as "true" / "false" strings
    const strValue = String(newValue);
    
    setSettings((prev: any) => ({ ...prev, [key]: newValue }));
    
    try {
      await api.settings.update(key, strValue);
    } catch (e) {
      console.error(e);
      // Revert on failure
      setSettings((prev: any) => ({ ...prev, [key]: !newValue }));
    }
  };

  const getBool = (key: string) => settings[key] === 'true' || settings[key] === true;

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <AdminHeader title="System Settings" />
      <div style={{ padding: '32px', maxWidth: '800px' }}>
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b' }}>Global Configuration</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Allow New User Signups</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>If disabled, only admins can create users.</p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
              <input 
                type="checkbox" 
                checked={getBool('allow_signups')} 
                onChange={() => handleToggle('allow_signups')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{ 
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: getBool('allow_signups') ? '#3b82f6' : '#ccc', 
                borderRadius: '24px', transition: '.4s' 
              }}></span>
              <span style={{ 
                position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px', 
                backgroundColor: 'white', borderRadius: '50%', transition: '.4s',
                transform: getBool('allow_signups') ? 'translateX(24px)' : 'translateX(0)' 
              }}></span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Maintenance Mode</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>Disable access for non-admin users.</p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
              <input 
                type="checkbox" 
                checked={getBool('maintenance_mode')} 
                onChange={() => handleToggle('maintenance_mode')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{ 
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: getBool('maintenance_mode') ? '#3b82f6' : '#ccc', 
                borderRadius: '24px', transition: '.4s' 
              }}></span>
              <span style={{ 
                position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px', 
                backgroundColor: 'white', borderRadius: '50%', transition: '.4s',
                transform: getBool('maintenance_mode') ? 'translateX(24px)' : 'translateX(0)' 
              }}></span>
            </label>
          </div>

        </div>
      </div>
    </>
  );
}
