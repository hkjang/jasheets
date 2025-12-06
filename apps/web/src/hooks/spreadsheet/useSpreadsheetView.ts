import { useState, useCallback } from 'react';
import { ColumnDef, RowDef, DEFAULT_CONFIG } from '@/types/spreadsheet';

interface UseSpreadsheetViewProps {
    initialRows?: RowDef[];
    initialCols?: ColumnDef[];
}

export function useSpreadsheetView({ initialRows, initialCols }: UseSpreadsheetViewProps = {}) {
    // Columns & Rows
    const [columns, setColumns] = useState<ColumnDef[]>(() =>
        initialCols || Array(DEFAULT_CONFIG.totalCols).fill(null).map(() => ({ width: DEFAULT_CONFIG.defaultColWidth }))
    );
    const [rows, setRows] = useState<RowDef[]>(() =>
        initialRows || Array(DEFAULT_CONFIG.totalRows).fill(null).map(() => ({ height: DEFAULT_CONFIG.defaultRowHeight }))
    );

    // Spreadsheet Config (Freeze, etc)
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    // View Options state
    const [showFormulaBar, setShowFormulaBar] = useState(true);
    const [showGridlines, setShowGridlines] = useState(true);

    const handleColumnResize = useCallback((index: number, width: number) => {
        setColumns(prev => {
            const newCols = [...prev];
            if (newCols[index]) newCols[index] = { ...newCols[index], width };
            else newCols[index] = { width };
            return newCols;
        });
    }, []);

    const handleRowResize = useCallback((index: number, height: number) => {
        setRows(prev => {
            const newRows = [...prev];
            if (newRows[index]) newRows[index] = { ...newRows[index], height };
            else newRows[index] = { height };
            return newRows;
        });
    }, []);

    const handleFreezeRow = useCallback((rowIndex: number) => {
        setConfig(prev => ({ ...prev, frozenRows: rowIndex }));
    }, []);

    const handleFreezeCol = useCallback((colIndex: number) => {
        setConfig(prev => ({ ...prev, frozenCols: colIndex }));
    }, []);

    return {
        columns,
        setColumns,
        rows,
        setRows,
        config,
        setConfig,
        showFormulaBar,
        setShowFormulaBar,
        showGridlines,
        setShowGridlines,
        handleColumnResize,
        handleRowResize,
        handleFreezeRow,
        handleFreezeCol,
    };
}
