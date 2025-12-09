'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Spreadsheet from '@/components/spreadsheet/Spreadsheet';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function SpreadsheetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  
  // Prevent duplicate API calls
  const fetchedRef = useRef(false);
  
  // Auth check
  const { user, loading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    // Skip if already fetched, no id, or still checking auth
    if (fetchedRef.current || !id || authLoading || !user) {
      return;
    }
    
    fetchedRef.current = true;
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
      .catch(err => {
        console.error('Failed to load spreadsheet:', err);
        // Check if it's an auth error
        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
          // Clear token and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          router.replace('/login');
        } else {
          setError('Failed to load spreadsheet');
        }
      })
      .finally(() => setLoading(false));
  }, [id, authLoading, user, router]);

  // Show loading while checking auth
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">Checking authentication...</div>;
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return <div className="flex h-screen items-center justify-center">Redirecting to login...</div>;
  }

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
  
  return <Spreadsheet key={activeSheetId} initialData={data} spreadsheetId={id} activeSheetId={activeSheetId} title={title} />;
}
