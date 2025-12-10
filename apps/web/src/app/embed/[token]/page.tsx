'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import EmbedSpreadsheet from '@/components/embed/EmbedSpreadsheet';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface EmbedOptions {
    showToolbar: boolean;
    showTabs: boolean;
    showGridlines: boolean;
}

export default function EmbedPage() {
    const params = useParams();
    const token = params.token as string;
    const [data, setData] = useState<any>(null);
    const [options, setOptions] = useState<EmbedOptions>({
        showToolbar: false,
        showTabs: true,
        showGridlines: true,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current || !token) {
            return;
        }

        fetchedRef.current = true;
        setLoading(true);

        fetch(`${API_URL}/embed/${token}`)
            .then(res => {
                if (!res.ok) {
                    if (res.status === 404) throw new Error('임베딩을 찾을 수 없습니다');
                    if (res.status === 403) throw new Error('이 시트에 대한 접근이 허용되지 않습니다');
                    throw new Error('시트를 불러오는데 실패했습니다');
                }
                return res.json();
            })
            .then(result => {
                const { spreadsheet, options: embedOptions } = result;
                setOptions(embedOptions);

                // Convert sheet data
                const sheets = spreadsheet.sheets || [];
                if (sheets.length > 0) {
                    const firstSheet = sheets[0];
                    const sheetData: any = {};
                    if (firstSheet.cells) {
                        firstSheet.cells.forEach((c: any) => {
                            if (!sheetData[c.row]) sheetData[c.row] = {};
                            sheetData[c.row][c.col] = { value: c.value, style: c.style, formula: c.formula };
                        });
                    }
                    setData({
                        spreadsheet,
                        sheetData,
                        activeSheet: firstSheet,
                        charts: firstSheet.charts || [],
                    });
                } else {
                    setData({
                        spreadsheet,
                        sheetData: {},
                        activeSheet: null,
                        charts: [],
                    });
                }
            })
            .catch(err => {
                console.error('Failed to load embedded sheet:', err);
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <p className="text-gray-800 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <p className="text-gray-600">데이터를 찾을 수 없습니다</p>
            </div>
        );
    }

    return (
        <EmbedSpreadsheet
            spreadsheet={data.spreadsheet}
            sheetData={data.sheetData}
            activeSheet={data.activeSheet}
            charts={data.charts}
            options={options}
        />
    );
}
