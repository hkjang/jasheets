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

  useEffect(() => {
    if (id) {
       setLoading(true);
       api.spreadsheets.get(id)
         .then(res => {
            // Transform backend response to SheetData if necessary
            // Backend returns Spreadsheet object with sheets, cells etc.
            // Spreadsheet component expects SheetData = Record<row, Record<col, Cell>>
            // We need a transformer here or inside Spreadsheet component.
            // Assuming Spreadsheet.tsx (useSpreadsheetData) expects keyed object.
            
            // Backend structure: { sheets: [ { cells: [ { row, col, value } ] } ] }
            // We need to map this to the format expected by Spreadsheet.tsx
            
            // Let's pass the raw response and let Spreadsheet handle it?
            // Existing Spreadsheet.tsx expects `SheetData` interface which is { [row]: { [col]: Cell } }
            // But it iterates `Object.keys(data)`...
            
            // Wait, existing Spreadsheet code:
            // const { data, setData ... } = useSpreadsheetData({ initialData });
            
            // If I look at useSpreadsheetData, I can see what it expects.
            // But for now, I'll transform it here simply:
            const sheets = res.sheets || [];
            if (sheets.length > 0) {
               const firstSheet = sheets[0]; // TODO: Multi-sheet support
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
  
  return <Spreadsheet initialData={data} spreadsheetId={id} />;
}
