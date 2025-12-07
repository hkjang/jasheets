'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Spreadsheet from '@/components/spreadsheet/Spreadsheet';
import { api } from '@/lib/api';

export default function SpreadsheetPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (id) {
       setLoading(true);
       api.spreadsheets.get(id)
         .then(res => {
            setTitle(res.name || 'Untitled Spreadsheet'); 
            const sheets = res.sheets || [];
            if (sheets.length > 0) {
               const firstSheet = sheets[0]; 
               setActiveSheetId(firstSheet.id);
               
               const sheetData: any = {};
               if (firstSheet.cells) {
                   firstSheet.cells.forEach((c: any) => {
                       if (!sheetData[c.row]) sheetData[c.row] = {};
                       sheetData[c.row][c.col] = { value: c.value, style: c.style, formula: c.formula };
                   });
               }
               setData(sheetData);
            } else {
               setData({});
            }
         })
         .catch(err => setError('Failed to load spreadsheet'))
         .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
  
  return <Spreadsheet initialData={data} spreadsheetId={id} activeSheetId={activeSheetId} title={title} />;
}
