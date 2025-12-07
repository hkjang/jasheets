'use client';

import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { useState } from 'react';
import NoticeBanner from '@/components/dashboard/NoticeBanner';
import { UserSpreadsheetList } from '@/components/dashboard/UserSpreadsheetList';
import { TemplateGallery } from '@/components/dashboard/TemplateGallery';
import WorkflowManager from '@/components/dashboard/WorkflowManager';
import { useRouter } from 'next/navigation';

type DashboardTab = 'spreadsheets' | 'workflows';

export default function DashboardPage() {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('spreadsheets');
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center text-white font-bold">J</div>
            <span className="text-xl font-bold text-gray-800">JaSheets</span>
        </div>
        <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/admin')} className="text-gray-600 hover:text-gray-900">Admin</button>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-8 h-8 bg-gray-200 rounded-full hover:ring-2 hover:ring-blue-500 transition focus:outline-none"
              title="Edit Profile"
            >
              <span className="sr-only">Profile</span>
            </button>
        </div>
      </header>
      
      <main className="container mx-auto max-w-6xl py-8 px-4">
        <NoticeBanner />
        
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Workspace</h1>
            <p className="text-gray-500">Manage your spreadsheets, templates, and automations.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('spreadsheets')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'spreadsheets'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            📊 Spreadsheets
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'workflows'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            ⚡ Workflows
          </button>
        </div>

        {/* Spreadsheets Tab */}
        {activeTab === 'spreadsheets' && (
          <>
            <TemplateGallery />
            <UserSpreadsheetList onSelect={(id: string) => {
              setSelectedSpreadsheetId(id);
              setActiveTab('workflows');
            }} />
          </>
        )}

        {/* Workflows Tab */}
        {activeTab === 'workflows' && (
          <div className="space-y-6">
            {/* Spreadsheet Selector */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a spreadsheet to manage its workflows
              </label>
              <SpreadsheetSelector
                value={selectedSpreadsheetId}
                onChange={setSelectedSpreadsheetId}
              />
            </div>

            {/* Workflow Manager */}
            {selectedSpreadsheetId ? (
              <WorkflowManager spreadsheetId={selectedSpreadsheetId} />
            ) : (
              <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
                <span className="text-5xl mb-4 block">⚡</span>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Select a spreadsheet
                </h3>
                <p className="text-gray-500">
                  Choose a spreadsheet above to manage its flows, webhooks, and event rules.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <ProfileDialog isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}

// Spreadsheet Selector Component
interface SpreadsheetSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

function SpreadsheetSelector({ value, onChange }: SpreadsheetSelectorProps) {
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    const loadSpreadsheets = async () => {
      try {
        const { api } = await import('@/lib/api');
        const data = await api.spreadsheets.list();
        setSpreadsheets(data);
      } catch (err) {
        console.error('Failed to load spreadsheets');
      } finally {
        setLoading(false);
      }
    };
    loadSpreadsheets();
  });

  if (loading) {
    return (
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
    >
      <option value="">-- Select a spreadsheet --</option>
      {spreadsheets.map((sheet) => (
        <option key={sheet.id} value={sheet.id}>
          {sheet.name}
        </option>
      ))}
    </select>
  );
}
