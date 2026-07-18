import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, type SpreadsheetSummary } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface UserSpreadsheetListProps {
  onSelect?: (id: string) => void;
}

export const UserSpreadsheetList = ({ onSelect }: UserSpreadsheetListProps) => {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const requestRef = useRef(0);

  const loadSpreadsheets = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await api.spreadsheets.list(
        activeTab === 'all' ? undefined : activeTab,
        searchTerm,
        signal,
      );
      if (requestId === requestRef.current) setSpreadsheets(data);
    } catch (loadError) {
      if (signal?.aborted || (loadError instanceof DOMException && loadError.name === 'AbortError')) return;
      console.error('Failed to load spreadsheets:', loadError);
      if (requestId === requestRef.current) {
        setError(
          loadError instanceof DOMException && loadError.name === 'TimeoutError'
            ? '서버 응답이 늦어지고 있습니다. 네트워크를 확인하고 다시 시도해 주세요.'
            : '스프레드시트 목록을 불러오지 못했습니다.',
        );
      }
    } finally {
      if (requestId === requestRef.current && !signal?.aborted) setLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadSpreadsheets(controller.signal);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadSpreadsheets]);

  const handleCreate = async () => {
    const name = prompt('Enter spreadsheet name:', 'Untitled Spreadsheet');
    if (!name) return;
    try {
        const newSheet = await api.spreadsheets.create({ name });
        router.push(`/spreadsheet/${newSheet.id}`);
    } catch {
        alert('Failed to create spreadsheet');
    }
  };
  
  const handleOpen = (id: string) => {
      router.push(`/spreadsheet/${id}`);
  };

  const handleWorkflows = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (onSelect) {
          onSelect(id);
      } else {
          router.push(`/spreadsheet/${id}?tab=workflows`);
      }
  };

  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
          const res = await api.spreadsheets.toggleFavorite(id);
          setSpreadsheets(prev => prev.map(s => s.id === id ? { ...s, isFavorite: res.isFavorite } : s));
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {['all', 'favorites', 'shared', 'created'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={activeTab === tab}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Search spreadsheets..." 
                    aria-label="스프레드시트 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <button 
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
                New Spreadsheet
            </button>
        </div>
      </div>

      {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite" aria-label="스프레드시트 목록을 불러오는 중">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-5 h-9 w-9 rounded-lg bg-green-100" />
                <div className="mb-3 h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center" role="alert">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-white text-red-600 shadow-sm" aria-hidden="true">!</div>
          <h2 className="font-semibold text-gray-900">목록을 표시할 수 없습니다</h2>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadSpreadsheets()}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            다시 시도
          </button>
        </div>
      ) : spreadsheets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <p className="text-gray-500 mb-4">No spreadsheets found.</p>
          <button onClick={handleCreate} className="text-blue-600 hover:underline">Create a new one</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spreadsheets.map((sheet) => (
            <div 
                key={sheet.id} 
                className="group block p-5 bg-white border rounded-lg shadow-sm hover:shadow-md transition cursor-pointer relative"
                onClick={() => handleOpen(sheet.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-700 group-hover:bg-green-200 transition">
                   <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={(e) => handleWorkflows(e, sheet.id)}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-purple-600 transition"
                        title="Manage Workflows"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M13 2v2.05c3.39.49 6 3.38 6 6.85c0 1.23-.32 2.39-.88 3.39l1.47 1.47c.79-1.37 1.26-2.96 1.26-4.66c0-4.79-3.57-8.62-8.19-9.09V2h.34zm-2 0h.34a9.998 9.998 0 0 0-4.39 17.61l1.43-1.43A7.963 7.963 0 0 1 4.05 12.9c0-3.47 2.61-6.36 6-6.85V2zm1-2H9.71l-3.66 3.66l1.41 1.41L10 2.53l2.54 2.54l1.41-1.41L10.29 0zm5.84 15.84L17 15l.84.84c.39.39 1.02.39 1.41 0l1.41-1.41c.39-.39.39-1.02 0-1.41L17 9.29a.996.996 0 0 0-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41L15 13l-.84.84c-.39.39-.39 1.02 0 1.41s1.02.39 1.41 0l.84-.84z"/>
                        </svg>
                    </button>
                    <button 
                        onClick={(e) => toggleFavorite(e, sheet.id)}
                        className={`p-1 rounded-full hover:bg-gray-100 ${sheet.isFavorite ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                         <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                             <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                         </svg>
                    </button>
                    {sheet.owner && (
                        <Image
                          src={sheet.owner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(sheet.owner.name)}`}
                          alt={sheet.owner.name}
                          width={32}
                          height={32}
                          unoptimized
                          className="ml-2 h-8 w-8 rounded-full"
                          title={sheet.owner.name}
                        />
                    )}
                </div>
              </div>
              <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 truncate">{sheet.name}</h3>
              <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                 <span>{sheet._count?.sheets || 1} Sheets</span>
                 <span>{new Date(sheet.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
