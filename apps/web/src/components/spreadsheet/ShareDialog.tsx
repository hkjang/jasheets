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

interface EmbedConfig {
  id: string;
  embedToken: string;
  enabled: boolean;
  showToolbar: boolean;
  showTabs: boolean;
  showGridlines: boolean;
  allowedDomains: string[];
}

type TabType = 'share' | 'embed';

export default function ShareDialog({ isOpen, onClose, spreadsheetId }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('share');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Embed state
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedOptions, setEmbedOptions] = useState({
    showToolbar: false,
    showTabs: true,
    showGridlines: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
      loadEmbedConfig();
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
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const loadEmbedConfig = async () => {
    try {
      const config = await api.spreadsheets.getEmbed(spreadsheetId);
      setEmbedConfig(config);
      if (config) {
        setEmbedOptions({
          showToolbar: config.showToolbar,
          showTabs: config.showTabs,
          showGridlines: config.showGridlines,
        });
      }
    } catch (e) {
      console.error('Failed to load embed config:', e);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await api.spreadsheets.addPermission(spreadsheetId, inviteEmail, inviteRole);
      setInviteEmail('');
      loadPermissions();
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

  // Embed handlers
  const handleEnableEmbed = async () => {
    setEmbedLoading(true);
    try {
      const config = await api.spreadsheets.createEmbed(spreadsheetId, {
        enabled: true,
        ...embedOptions,
      });
      setEmbedConfig(config);
    } catch (e) {
      alert('Failed to enable embedding');
    } finally {
      setEmbedLoading(false);
    }
  };

  const handleDisableEmbed = async () => {
    if (!confirm('Disable embedding? Existing embeds will stop working.')) return;
    setEmbedLoading(true);
    try {
      await api.spreadsheets.deleteEmbed(spreadsheetId);
      setEmbedConfig(null);
    } catch (e) {
      alert('Failed to disable embedding');
    } finally {
      setEmbedLoading(false);
    }
  };

  const handleUpdateEmbedOptions = async () => {
    setEmbedLoading(true);
    try {
      const config = await api.spreadsheets.createEmbed(spreadsheetId, embedOptions);
      setEmbedConfig(config);
      alert('Settings saved!');
    } catch (e) {
      alert('Failed to update embed settings');
    } finally {
      setEmbedLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Regenerate token? Existing embeds will stop working.')) return;
    setEmbedLoading(true);
    try {
      const config = await api.spreadsheets.regenerateEmbedToken(spreadsheetId);
      setEmbedConfig(config);
      alert('Token regenerated!');
    } catch (e) {
      alert('Failed to regenerate token');
    } finally {
      setEmbedLoading(false);
    }
  };

  const getEmbedUrl = () => {
    if (!embedConfig) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/embed/${embedConfig.embedToken}`;
  };

  const getIframeCode = () => {
    const url = getEmbedUrl();
    return `<iframe src="${url}" width="800" height="600" frameborder="0"></iframe>`;
  };

  const copyEmbedUrl = () => {
    navigator.clipboard.writeText(getEmbedUrl());
    alert('Embed URL copied!');
  };

  const copyIframeCode = () => {
    navigator.clipboard.writeText(getIframeCode());
    alert('HTML code copied!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Share & Embed</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'share' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('share')}
          >
            공유
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'embed' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('embed')}
          >
            임베딩
          </button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : activeTab === 'share' ? (
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
          </div>
        ) : (
          /* Embed Tab */
          <div className="space-y-4">
            {!embedConfig ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  이 시트를 다른 웹사이트에 임베딩할 수 있도록 설정합니다.
                </p>
                <button
                  onClick={handleEnableEmbed}
                  disabled={embedLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {embedLoading ? '처리 중...' : '임베딩 활성화'}
                </button>
              </div>
            ) : (
              <>
                {/* Embed URL */}
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium text-gray-900 mb-2">임베딩 URL</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getEmbedUrl()}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded bg-white text-sm font-mono"
                    />
                    <button
                      onClick={copyEmbedUrl}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      복사
                    </button>
                  </div>
                </div>

                {/* HTML Code */}
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium text-gray-900 mb-2">HTML 코드</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getIframeCode()}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded bg-white text-sm font-mono"
                    />
                    <button
                      onClick={copyIframeCode}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      복사
                    </button>
                  </div>
                </div>

                {/* Display Options */}
                <div className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium text-gray-900 mb-3">표시 옵션</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={embedOptions.showToolbar}
                        onChange={e => setEmbedOptions(prev => ({ ...prev, showToolbar: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">툴바 표시</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={embedOptions.showTabs}
                        onChange={e => setEmbedOptions(prev => ({ ...prev, showTabs: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">시트 탭 표시</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={embedOptions.showGridlines}
                        onChange={e => setEmbedOptions(prev => ({ ...prev, showGridlines: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">그리드선 표시</span>
                    </label>
                  </div>
                  <button
                    onClick={handleUpdateEmbedOptions}
                    disabled={embedLoading}
                    className="mt-3 px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm disabled:opacity-50"
                  >
                    설정 저장
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-2 border-t">
                  <button
                    onClick={handleRegenerateToken}
                    disabled={embedLoading}
                    className="px-3 py-2 text-orange-600 border border-orange-600 rounded hover:bg-orange-50 text-sm disabled:opacity-50"
                  >
                    토큰 재생성
                  </button>
                  <button
                    onClick={handleDisableEmbed}
                    disabled={embedLoading}
                    className="px-3 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 text-sm disabled:opacity-50"
                  >
                    임베딩 비활성화
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 mt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
