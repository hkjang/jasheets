'use client';

import { useState, useMemo, useCallback } from 'react';
import SpreadsheetCanvas from '@/components/spreadsheet/SpreadsheetCanvas';
import ChartComponent from '@/components/charts/ChartComponent';
import { SheetData, CellPosition, CellRange, ColumnDef, RowDef, DEFAULT_CONFIG } from '@/types/spreadsheet';
import styles from './EmbedSpreadsheet.module.css';

interface EmbedOptions {
    showToolbar: boolean;
    showTabs: boolean;
    showGridlines: boolean;
}

interface EmbedSpreadsheetProps {
    spreadsheet: any;
    sheetData: SheetData;
    activeSheet: any;
    charts?: any[];
    options: EmbedOptions;
}

export default function EmbedSpreadsheet({
    spreadsheet,
    sheetData,
    activeSheet,
    charts = [],
    options,
}: EmbedSpreadsheetProps) {
    const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
    const [selection, setSelection] = useState<CellRange | null>(null);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [currentData, setCurrentData] = useState<SheetData>(sheetData);
    const [currentCharts, setCurrentCharts] = useState<any[]>(charts);

    const sheets = spreadsheet?.sheets || [];
    const currentSheet = sheets[activeSheetIndex] || activeSheet;

    // Generate columns
    const columns: ColumnDef[] = useMemo(() => {
        const cols: ColumnDef[] = [];
        const colCount = currentSheet?.colCount || DEFAULT_CONFIG.totalCols;
        const colMeta = currentSheet?.colMeta || [];

        for (let i = 0; i < colCount; i++) {
            const meta = colMeta.find((m: any) => m.col === i);
            cols.push({
                width: meta?.width || DEFAULT_CONFIG.defaultColWidth,
                hidden: meta?.hidden || false,
            });
        }
        return cols;
    }, [currentSheet]);

    // Generate rows
    const rows: RowDef[] = useMemo(() => {
        const rowList: RowDef[] = [];
        const rowCount = currentSheet?.rowCount || DEFAULT_CONFIG.totalRows;
        const rowMeta = currentSheet?.rowMeta || [];

        for (let i = 0; i < rowCount; i++) {
            const meta = rowMeta.find((m: any) => m.row === i);
            rowList.push({
                height: meta?.height || DEFAULT_CONFIG.defaultRowHeight,
                hidden: meta?.hidden || false,
            });
        }
        return rowList;
    }, [currentSheet]);

    // Handle sheet tab change
    const handleSheetChange = useCallback((index: number) => {
        const sheet = sheets[index];
        if (!sheet) return;

        setActiveSheetIndex(index);

        // Convert cells to SheetData format
        const newData: SheetData = {};
        if (sheet.cells) {
            sheet.cells.forEach((c: any) => {
                if (!newData[c.row]) newData[c.row] = {};
                newData[c.row][c.col] = { value: c.value, style: c.format, formula: c.formula };
            });
        }
        setCurrentData(newData);
        setCurrentCharts(sheet.charts || []);
        setSelectedCell(null);
        setSelection(null);
    }, [sheets]);

    // Dummy handlers for read-only mode
    const handleCellSelect = useCallback((pos: CellPosition) => {
        setSelectedCell(pos);
        setSelection({ start: pos, end: pos });
    }, []);

    const handleSelectionChange = useCallback((range: CellRange) => {
        setSelection(range);
    }, []);

    const handleCellEdit = useCallback(() => {
        // Read-only mode - do nothing
    }, []);

    return (
        <div className={styles.container}>
            {/* Header */}
            {options.showToolbar && (
                <div className={styles.toolbar}>
                    <div className={styles.title}>
                        <span className={styles.icon}>📊</span>
                        <span>{spreadsheet?.name || 'Spreadsheet'}</span>
                    </div>
                    <a
                        href={`/spreadsheet/${spreadsheet?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.openLink}
                    >
                        JaSheets에서 열기 ↗
                    </a>
                </div>
            )}

            {/* Canvas with Charts Overlay */}
            <div className={styles.canvasWrapper}>
                <SpreadsheetCanvas
                    data={currentData}
                    columns={columns}
                    rows={rows}
                    config={{
                        totalRows: currentSheet?.rowCount || DEFAULT_CONFIG.totalRows,
                        totalCols: currentSheet?.colCount || DEFAULT_CONFIG.totalCols,
                    }}
                    selectedCell={selectedCell}
                    selection={selection}
                    onCellSelect={handleCellSelect}
                    onSelectionChange={handleSelectionChange}
                    onCellEdit={handleCellEdit}
                    showGridlines={options.showGridlines}
                />

                {/* Read-only Chart Overlay */}
                {currentCharts.length > 0 && (
                    <div className={styles.chartOverlay}>
                        {currentCharts.map((chart: any) => (
                            <div
                                key={chart.id}
                                className={styles.chartContainer}
                                style={{
                                    left: chart.x,
                                    top: chart.y,
                                    width: chart.width,
                                    height: chart.height,
                                }}
                            >
                                <ChartComponent
                                    type={chart.type}
                                    data={chart.data?.datasets ?
                                        // Convert chart.js format back to raw data format
                                        [
                                            chart.data.labels || [],
                                            ...(chart.data.datasets?.map((ds: any) => ds.data) || [])
                                        ] : chart.data || []}
                                    options={chart.options}
                                    width={chart.width - 16}
                                    height={chart.height - 16}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sheet Tabs */}
            {options.showTabs && sheets.length > 1 && (
                <div className={styles.tabs}>
                    {sheets.map((sheet: any, index: number) => (
                        <button
                            key={sheet.id}
                            className={`${styles.tab} ${index === activeSheetIndex ? styles.activeTab : ''}`}
                            onClick={() => handleSheetChange(index)}
                        >
                            {sheet.name || `Sheet ${index + 1}`}
                        </button>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
                <span className={styles.poweredBy}>
                    Powered by <strong>JaSheets</strong>
                </span>
            </div>
        </div>
    );
}

