import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Spreadsheet {
  id: string;
  name: string;
  updatedAt: string;
  owner?: { name: string; email: string; avatar: string };
  _count?: { sheets: number };
}

export const UserSpreadsheetList = () => {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadSpreadsheets();
  }, []);

  const loadSpreadsheets = async () => {
    try {
      setLoading(true);
      const data = await api.spreadsheets.list();
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
      // Assuming the route for opening a sheet is /sheet/[id] or just /?id=[id]
      // Based on existing app/page.tsx, it might store ID in URL or query param, 
      // but typically we'd use a dynamic route.
      // For now, let's assume /sheet/[id] is the goal, or I might need to check if that route exists.
      // Existing page.tsx is at root. I might need to move it or create a new route.
      // For now, let's try pushing to /?id={id} based on typical single-page patterns 
      // OR Create proper routing. 
      // Let's assume /spreadsheet/[id]
      router.push(`/spreadsheet/${id}`);
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Recent Spreadsheets</h2>
        <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
            New Spreadsheet
        </button>
      </div>

      {spreadsheets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <p className="text-gray-500 mb-4">No spreadsheets found.</p>
          <button onClick={handleCreate} className="text-blue-600 hover:underline">Create a new one</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spreadsheets.map((sheet) => (
            <div 
                key={sheet.id} 
                onClick={() => handleOpen(sheet.id)}
                className="group block p-5 bg-white border rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-700 group-hover:bg-green-200 transition">
                   <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>
                </div>
                {sheet.owner && (
                    <img src={sheet.owner.avatar} alt={sheet.owner.name} className="w-8 h-8 rounded-full ml-2" title={sheet.owner.name} />
                )}
              </div>
              <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 truncate">{sheet.name}</h3>
              <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                 <span>{sheet._count?.sheets || 1} Sheets</span>
                 <span>Last edited {new Date(sheet.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
