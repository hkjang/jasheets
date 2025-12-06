import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Spreadsheet {
  id: string;
  name: string;
  updatedAt: string;
  owner?: { name: string; email: string; avatar: string };
  _count?: { sheets: number };
  isFavorite?: boolean;
}

export const UserSpreadsheetList = () => {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSpreadsheets();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, searchTerm]);

  const loadSpreadsheets = async () => {
    try {
      setLoading(true);
      const data = await api.spreadsheets.list(activeTab === 'all' ? undefined : activeTab, searchTerm);
      setSpreadsheets(data);
    } catch (error) {
      console.error('Failed to load spreadsheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Enter spreadsheet name:', 'Untitled Spreadsheet');
    if (!name) return;
    try {
        const newSheet = await api.spreadsheets.create({ name });
        router.push(`/sheet/${newSheet.id}`);
    } catch (err) {
        alert('Failed to create spreadsheet');
    }
  };
  
  const handleOpen = (id: string) => {
      router.push(`/spreadsheet/${id}`);
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
          <div className="text-center py-12">Loading...</div>
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
                <div className="flex items-center">
                    <button 
                        onClick={(e) => toggleFavorite(e, sheet.id)}
                        className={`p-1 rounded-full hover:bg-gray-100 ${sheet.isFavorite ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                         <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                             <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                         </svg>
                    </button>
                    {sheet.owner && (
                        <img src={sheet.owner.avatar || `https://ui-avatars.com/api/?name=${sheet.owner.name}`} alt={sheet.owner.name} className="w-8 h-8 rounded-full ml-2" title={sheet.owner.name} />
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
