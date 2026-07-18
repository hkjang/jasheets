'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import EmbedSpreadsheet from '@/components/embed/EmbedSpreadsheet';
import { ApiError, apiClient } from '@/lib/api-client';
import { SpreadsheetErrorState, SpreadsheetLoadingState } from '@/components/ui/PageLoadState';
import type { CellStyle, SheetData } from '@/types/spreadsheet';

interface EmbedOptions {
    showToolbar: boolean;
    showTabs: boolean;
    showGridlines: boolean;
}

interface EmbeddedCell {
    row: number;
    col: number;
    value: string | number | boolean | null;
    formula?: string | null;
    format?: CellStyle;
}

interface EmbeddedSheet {
    id: string;
    cells?: EmbeddedCell[];
    charts?: unknown[];
}

interface EmbeddedSpreadsheetRecord {
    id: string;
    name?: string;
    sheets?: EmbeddedSheet[];
}

interface EmbedResponse {
    spreadsheet: EmbeddedSpreadsheetRecord;
    options?: Partial<EmbedOptions>;
}

interface LoadedEmbed {
    spreadsheet: EmbeddedSpreadsheetRecord;
    sheetData: SheetData;
    activeSheet: EmbeddedSheet | null;
    charts: unknown[];
}

const DEFAULT_OPTIONS: EmbedOptions = {
    showToolbar: false,
    showTabs: true,
    showGridlines: true,
};

export default function EmbedPage() {
    const params = useParams();
    const token = params.token as string;
    const [data, setData] = useState<LoadedEmbed | null>(null);
    const [options, setOptions] = useState<EmbedOptions>(DEFAULT_OPTIONS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const requestRef = useRef(0);

    const loadEmbed = useCallback(async () => {
        if (!token) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const requestId = ++requestRef.current;
        setLoading(true);
        setError(null);

        try {
                const result = await apiClient.request<EmbedResponse>(`/embed/${token}`, {
                    signal: controller.signal,
                    retries: 1,
                });
                if (requestId !== requestRef.current) return;
                const { spreadsheet, options: embedOptions } = result;
                setOptions({ ...DEFAULT_OPTIONS, ...embedOptions });

                const sheets = spreadsheet.sheets || [];
                if (sheets.length > 0) {
                    const firstSheet = sheets[0];
                    const sheetData: SheetData = {};
                    firstSheet.cells?.forEach((cell) => {
                            if (!sheetData[cell.row]) sheetData[cell.row] = {};
                            sheetData[cell.row][cell.col] = {
                                value: cell.value,
                                style: cell.format,
                                formula: cell.formula ?? undefined,
                            };
                        });
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
            } catch (loadError) {
                if (controller.signal.aborted || (loadError instanceof DOMException && loadError.name === 'AbortError')) return;
                console.error('Failed to load embedded sheet:', loadError);
                if (loadError instanceof ApiError && loadError.status === 404) {
                    setError('공유 링크가 만료되었거나 존재하지 않습니다. 문서 소유자에게 새 링크를 요청해 주세요.');
                } else if (loadError instanceof ApiError && loadError.status === 403) {
                    setError('이 문서는 현재 외부에 공개되어 있지 않습니다.');
                } else if (loadError instanceof DOMException && loadError.name === 'TimeoutError') {
                    setError('서버 응답이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
                } else {
                    setError('공유 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
                }
            } finally {
                if (requestId === requestRef.current && !controller.signal.aborted) setLoading(false);
            }
    }, [token]);

    useEffect(() => {
        void loadEmbed();
        return () => abortRef.current?.abort();
    }, [loadEmbed]);

    if (loading) {
        return <SpreadsheetLoadingState />;
    }

    if (error) {
        return (
            <SpreadsheetErrorState
                title="공유 문서를 열 수 없습니다"
                message={error}
                onRetry={() => void loadEmbed()}
            />
        );
    }

    if (!data) {
        return (
            <SpreadsheetErrorState
                title="표시할 데이터가 없습니다"
                message="문서에 공개 가능한 시트가 없습니다."
                onRetry={() => void loadEmbed()}
            />
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
