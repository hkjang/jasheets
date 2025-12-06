'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
}

interface Permission {
  id: string;
  email: string | null;
  role: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'OWNER';
  user?: {
    name?: string;
    avatar?: string;
  };
}

export default function ShareDialog({ isOpen, onClose, spreadsheetId }: ShareDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
    }
  }, [isOpen, spreadsheetId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await api.spreadsheets.listPermissions(spreadsheetId);
      setPermissions(data.permissions);
      setIsPublic(data.isPublic);
    } catch (e) {
      console.error(e);
      alert('Failed to load permissions. You might not be the owner.');
      onClose(); // Close if not allowed
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await api.spreadsheets.addPermission(spreadsheetId, inviteEmail, inviteRole);
      setInviteEmail('');
      loadPermissions(); // Reload
    } catch (e) {
      alert('Failed to invite user. User might not exist.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (permId: string) => {
    if (!confirm('Remove this user?')) return;
    try {
      await api.spreadsheets.removePermission(spreadsheetId, permId);
      loadPermissions();
    } catch (e) {
      alert('Failed to remove permissions');
    }
  };

  const handlePublicToggle = async (checked: boolean) => {
    try {
      await api.spreadsheets.updatePublicAccess(spreadsheetId, checked);
      setIsPublic(checked);
    } catch (e) {
      alert('Failed to update public access');
    }
  };

  const copyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-gray-800">Share Spreadsheet</h2>
             <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>
        
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Invite Section */}
            <div>
                 <form onSubmit={handleInvite} className="flex gap-2">
                     <input 
                       type="email" 
                       placeholder="Enter email to invite"
                       value={inviteEmail}
                       onChange={e => setInviteEmail(e.target.value)}
                       className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                       required
                     />
                     <select 
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                        className="px-3 py-2 border rounded bg-white"
                     >
                         <option value="VIEWER">Viewer</option>
                         <option value="EDITOR">Editor</option>
                     </select>
                     <button 
                        type="submit" 
                        disabled={inviteLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                     >
                         Invite
                     </button>
                 </form>
            </div>

            {/* Public Access Section */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                    <h3 className="font-medium text-gray-900">General Access</h3>
                    <p className="text-sm text-gray-500">
                        {isPublic ? 'Anyone with the link can view' : 'Restricted to added users'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                   <select 
                      value={isPublic ? 'public' : 'restricted'}
                      onChange={(e) => handlePublicToggle(e.target.value === 'public')}
                      className="text-sm border-none bg-transparent font-medium text-blue-600 cursor-pointer focus:ring-0"
                   >
                       <option value="restricted">Restricted</option>
                       <option value="public">Anyone with link</option>
                   </select>
                   <button onClick={copyLink} className="text-sm border px-2 py-1 rounded hover:bg-gray-200">
                       Copy Link
                   </button>
                </div>
            </div>

            {/* Permissions List */}
            <div>
                <h3 className="font-medium mb-2 text-gray-700">People with access</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {permissions.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                    {perm.user?.avatar ? <img src={perm.user.avatar} className="w-full h-full rounded-full" /> : (perm.email?.[0] || 'U').toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">{perm.user?.name || perm.email}</div>
                                    <div className="text-xs text-gray-500">{perm.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">{perm.role}</span>
                                <button 
                                    onClick={() => handleRemove(perm.id)}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Remove access"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                    ))}
                    {permissions.length === 0 && (
                        <p className="text-sm text-gray-500 italic p-2">No other users have access.</p>
                    )}
                </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
