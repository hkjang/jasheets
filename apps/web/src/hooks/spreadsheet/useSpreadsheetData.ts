import { useState, useCallback, useEffect, useRef } from 'react';
import { CellData, CellRange, DataValidationRule, NamedRanges, ProtectedRange, SheetData, CellStyle } from '@/types/spreadsheet';
import { produce, applyPatches, Patch, enablePatches } from 'immer';
// Use local FormulaEngine
import { evaluateFormula, type FormulaWorkbook } from '@/utils/FormulaEngine';
import { formatValue } from '@/utils/formatting';
import { parseInput } from '@/utils/inputParser';
import { recalculate } from '@/utils/RecalculationEngine';
import { rewriteFormulaForStructuralChange, StructuralChange } from '@/utils/formulaReferences';
import { validateCellInput } from '@/utils/dataValidation';
import { canEditCell } from '@/utils/protectedRanges';
import { FormulaWorkerClient } from '@/utils/formulaWorkerClient';
import {
    collectPersistedCellUpdates,
    PersistedCellUpdate,
} from '@/utils/cellPersistence';
import { sortRangeData, sortRowsData } from '@/utils/spreadsheetSorting';

enablePatches();

// ... (existing code)

enablePatches();

interface Commit {
    patches: Patch[];
    inversePatches: Patch[];
}

interface UseSpreadsheetDataProps {
    initialData?: SheetData;
    onDataChange?: (data: SheetData) => void;
    onLocalCellsChange?: (updates: PersistedCellUpdate[]) => void;
    currentUserId?: string;
    workbook?: FormulaWorkbook;
    currentSheetName?: string;
}

function spillArray(
    draft: SheetData,
    originRow: number,
    originCol: number,
    values: number[][],
    formula: string,
    format: string,
): string | null {
    for (let rowOffset = 0; rowOffset < values.length; rowOffset++) {
        for (let colOffset = 0; colOffset < values[rowOffset].length; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const target = draft[originRow + rowOffset]?.[originCol + colOffset];
            const belongsToOrigin = target?.spillParent?.row === originRow && target.spillParent.col === originCol;
            if (target && target.value !== null && !belongsToOrigin) return '#SPILL!';
        }
    }

    for (let rowOffset = 0; rowOffset < values.length; rowOffset++) {
        if (!draft[originRow + rowOffset]) draft[originRow + rowOffset] = {};
        for (let colOffset = 0; colOffset < values[rowOffset].length; colOffset++) {
            const value = values[rowOffset][colOffset];
            draft[originRow + rowOffset][originCol + colOffset] = {
                value,
                displayValue: formatValue(value, format),
                formula: rowOffset === 0 && colOffset === 0 ? formula : undefined,
                format,
                spillParent: rowOffset === 0 && colOffset === 0 ? undefined : { row: originRow, col: originCol },
            };
        }
    }
    return null;
}

function rewriteFormulas(data: SheetData, change: StructuralChange): void {
    Object.keys(data).forEach((rowKey) => {
        const row = data[Number(rowKey)];
        Object.keys(row).forEach((colKey) => {
            const cell = row[Number(colKey)];
            if (cell?.formula) cell.formula = rewriteFormulaForStructuralChange(cell.formula, change);
        });
    });
}

export function useSpreadsheetData({
    initialData = {},
    onDataChange,
    onLocalCellsChange,
    currentUserId,
    workbook,
    currentSheetName,
}: UseSpreadsheetDataProps) {
    // Note: initialData is only used for initial state.
    // External updates should use updateData() directly to avoid infinite loops.
    const [data, setData] = useState<SheetData>(() => produce(initialData || {}, (draft) => {
        const calculationWorkbook = currentSheetName
            ? { ...workbook, [currentSheetName]: draft as unknown as SheetData }
            : workbook;
        recalculate(draft as unknown as SheetData, {}, undefined, calculationWorkbook);
    }));
    const [history, setHistory] = useState<Commit[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [namedRanges, setNamedRanges] = useState<NamedRanges>({});
    const [protectedRanges, setProtectedRanges] = useState<ProtectedRange[]>([]);
    const formulaWorkerRef = useRef<FormulaWorkerClient | null>(null);
    const workerGenerationRef = useRef(0);
    const workbookFor = useCallback((current: SheetData): FormulaWorkbook | undefined => (
        currentSheetName ? { ...workbook, [currentSheetName]: current } : workbook
    ), [currentSheetName, workbook]);

    useEffect(() => {
        if (typeof Worker === 'undefined') return;
        const worker = new Worker(new URL('../../workers/formula.worker.ts', import.meta.url));
        formulaWorkerRef.current = new FormulaWorkerClient(worker);
        return () => {
            formulaWorkerRef.current?.terminate();
            formulaWorkerRef.current = null;
        };
    }, []);

    // Helper to apply changes and record history
    const applyChange = useCallback((recipe: (draft: SheetData) => void) => {
        // A local edit makes any in-flight full-sheet worker result stale.
        workerGenerationRef.current++;
        let patches: Patch[] = [];
        let inversePatches: Patch[] = [];

        const nextState = produce(data, recipe, (p, ip) => {
            patches = p;
            inversePatches = ip;
        });

        setData(nextState);
        if (patches.length > 0) {
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push({ patches, inversePatches });
                return newHistory;
            });
            setHistoryIndex(prev => prev + 1);
            onLocalCellsChange?.(collectPersistedCellUpdates(data, nextState, patches));
        }

        onDataChange?.(nextState);
    }, [data, historyIndex, onDataChange, onLocalCellsChange]);

    // Direct update without history (e.g. from server)
    const updateData = useCallback((newData: SheetData) => {
        const generation = ++workerGenerationRef.current;
        setData(newData);
        const worker = formulaWorkerRef.current;
        if (!worker) return;
        void worker.calculate(newData, namedRanges, workbookFor(newData)).then((calculated) => {
            if (generation !== workerGenerationRef.current) return;
            setData(calculated);
            onDataChange?.(calculated);
        }).catch(() => {
            // Keep the server-provided values when worker calculation fails.
        });
    }, [namedRanges, onDataChange, workbookFor]);



    const setCellValue = useCallback((row: number, col: number, value: string) => {
        applyChange((draft) => {
            if (!canEditCell(protectedRanges, { row, col }, currentUserId)) return;
            if (!draft[row]) draft[row] = {};

            const validation = draft[row][col]?.validation;
            if (validation && !value.startsWith('=')) {
                const result = validateCellInput(value, validation);
                if (!result.valid) {
                    draft[row][col] = { ...draft[row][col], error: result.message };
                    return;
                }
            }

            // Check if value is formula
            const isFormula = value.startsWith('=');
            let displayValue = value;
            let error: string | undefined;
            let numValue: number | string | boolean | null = value;
            let detectedFormat: string | undefined;
            let arrayResult: number[][] | null = null;

            // Retrieve existing format
            const currentFormat = draft[row][col]?.format || 'general';

            if (isFormula) {
                try {
                    // ... formula eval ...
                    const currentData = draft as unknown as SheetData;
                    const result = evaluateFormula(value, currentData, namedRanges, 'en-US', workbookFor(currentData));
                    if (Array.isArray(result)) {
                        arrayResult = result;
                        numValue = result[0]?.[0] ?? '#VALUE!';
                        displayValue = String(numValue);
                    } else {
                    // Apply format to result
                    if (typeof result === 'number') {
                        displayValue = formatValue(result, currentFormat);
                    } else {
                        displayValue = String(result);
                    }
                    numValue = result;
                    }
                } catch (e) {
                    displayValue = '#ERROR!';
                    error = e instanceof Error ? e.message : 'Formula error';
                }
            } else {
                // Smart Parse
                const parsed = parseInput(value);
                numValue = parsed.value;

                if (parsed.format && parsed.format !== 'general' && currentFormat === 'general') {
                    detectedFormat = parsed.format;
                }
            }

            const finalFormat = detectedFormat || currentFormat;

            // Apply format if not formula
            if (!isFormula) {
                displayValue = formatValue(numValue, finalFormat);
            }

            draft[row][col] = {
                value: numValue,
                displayValue: displayValue,
                formula: isFormula ? value : undefined,
                error,
                style: draft[row][col]?.style,
                format: finalFormat,
                validation,
                link: draft[row][col]?.link,
            };

            if (arrayResult) {
                const spillError = spillArray(draft, row, col, arrayResult, value, finalFormat);
                if (spillError) {
                    draft[row][col] = { ...draft[row][col], value: spillError, displayValue: spillError, error: spillError };
                }
            }

            // Trigger Recalculation
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, [{ row, col }], workbookFor(currentData));
        });
    }, [applyChange, namedRanges, protectedRanges, currentUserId, workbookFor]);

    const updateCells = useCallback((updates: { row: number; col: number; value: string }[]) => {
        applyChange((draft) => {
            updates.forEach(({ row, col, value }) => {
                if (!canEditCell(protectedRanges, { row, col }, currentUserId)) return;
                if (!draft[row]) draft[row] = {};

                const validation = draft[row][col]?.validation;
                if (validation && !value.startsWith('=')) {
                    const validationResult = validateCellInput(value, validation);
                    if (!validationResult.valid) {
                        draft[row][col] = { ...draft[row][col], error: validationResult.message };
                        return;
                    }
                }

                const isFormula = value.startsWith('=');
                let displayValue = value;
                let error: string | undefined;
                let numValue: number | string | boolean | null = value;
                let detectedFormat: string | undefined;
                let arrayResult: number[][] | null = null;

                const currentFormat = draft[row][col]?.format || 'general';

                if (isFormula) {
                    try {
                        const currentData = draft as unknown as SheetData;
                        const result = evaluateFormula(value, currentData, namedRanges, 'en-US', workbookFor(currentData));
                        if (Array.isArray(result)) {
                            arrayResult = result;
                            numValue = result[0]?.[0] ?? '#VALUE!';
                            displayValue = String(numValue);
                        } else if (typeof result === 'number') {
                            displayValue = formatValue(result, currentFormat);
                        } else {
                            displayValue = String(result);
                        }
                        if (!Array.isArray(result)) numValue = result;
                    } catch (e) {
                        displayValue = '#ERROR!';
                        error = e instanceof Error ? e.message : 'Formula error';
                    }
                } else {
                    const parsed = parseInput(value);
                    numValue = parsed.value;
                    if (parsed.format && parsed.format !== 'general' && currentFormat === 'general') {
                        detectedFormat = parsed.format;
                    }
                }

                const finalFormat = detectedFormat || currentFormat;
                if (!isFormula) {
                    displayValue = formatValue(numValue, finalFormat);
                }

                draft[row][col] = {
                    value: numValue,
                    displayValue: displayValue,
                    formula: isFormula ? value : undefined,
                    error,
                    style: draft[row][col]?.style,
                    format: finalFormat,
                    validation,
                    link: draft[row][col]?.link,
                };
                if (arrayResult) {
                    const spillError = spillArray(draft, row, col, arrayResult, value, finalFormat);
                    if (spillError) {
                        draft[row][col] = { ...draft[row][col], value: spillError, displayValue: spillError, error: spillError };
                    }
                }
            });
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, updates.map(({ row, col }) => ({ row, col })), workbookFor(currentData));
        });
    }, [applyChange, namedRanges, protectedRanges, currentUserId, workbookFor]);

    const updateCellFormat = useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } } | null, format: string) => {
        if (!range) return;

        applyChange((draft) => {
            for (let row = range.start.row; row <= range.end.row; row++) {
                for (let col = range.start.col; col <= range.end.col; col++) {
                    if (!canEditCell(protectedRanges, { row, col }, currentUserId)) continue;
                    if (!draft[row]) draft[row] = {};

                    const cell = draft[row][col];
                    if (cell) {
                        cell.format = format;
                        // Re-calculate display value
                        if (typeof cell.value === 'number') {
                            cell.displayValue = formatValue(cell.value, format);
                        }
                        // If formula?
                        if (cell.formula) {
                            // Need to re-eval? Value shouldn't change, just display.
                            // But we don't store eval result separately from displayValue usually?
                            // Oh wait, setCellValue stores result (as displayValue). 
                            // If we have formula, we might need to re-eval to get raw number?
                            // OR distinct between 'cached result' and 'display text'.
                            // Current model: value = result (if formula is executed? No.)
                            // setCellValue: 
                            // draft[row][col].value = numValue (which is parse(value) if not formula).
                            // IF formula: value is ??? 
                            // Looking at setCellValue:
                            // const numValue = !isFormula ... ? float : value.
                            // So if formula, value is THE FORMULA STRING? No.
                            // `value` prop in CellData is `CellValue` (string|number).
                            // `formula` prop is the formula string.
                            // When formula exists, `value` usually holds the cached result?
                            // In typical sheets: formula is separate. `value` is the calculated result.
                            // Let's see setCellValue again.
                            // `draft[row][col] = { value: numValue ... formula: isFormula ? value : undefined }`
                            // If isFormula, numValue is just `value` (the formula string).
                            // This is wrong! `value` should be the RESULT.
                            // But `isFormula` check uses `startsWith('=')`.
                            // `numValue` logic: `!isFormula ... ? parseFloat : value`.
                            // So if isFormula, numValue = formula string.
                            // FormatValue takes the formula string and returns NaN -> string.

                            // Fix: We should store calculated result in `value` and formula string in `formula`.
                            // But setCellValue logic:
                            // `const result = evaluateFormula(...)`
                            // It does NOT store `result` in `value`. It implies `displayValue` is the result.
                            // This means we lose the raw number result if we just store displayValue string.
                            // If we want to format later, we need the raw number.

                            // Correction:
                            // If isFormula:
                            //   result = eval(...)
                            //   value = result (if number/string)
                            //   formula = inputString

                            // I should fix setCellValue to store result in `value` if formula.
                        }
                    } else {
                        draft[row][col] = { value: null, format };
                    }
                }
            }
        });
    }, [applyChange, protectedRanges, currentUserId]);

    const updateCellStyle = useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } } | null, styleUpdate: Partial<CellStyle>) => {
        if (!range) return;

        applyChange((draft) => {
            for (let row = range.start.row; row <= range.end.row; row++) {
                for (let col = range.start.col; col <= range.end.col; col++) {
                    if (!canEditCell(protectedRanges, { row, col }, currentUserId)) continue;
                    if (!draft[row]) draft[row] = {};
                    const currentStyle = draft[row][col]?.style || {};

                    if (!draft[row][col]) {
                        draft[row][col] = { value: null, style: { ...currentStyle, ...styleUpdate } };
                    } else {
                        draft[row][col]!.style = { ...currentStyle, ...styleUpdate };
                    }
                }
            }
        });
    }, [applyChange, protectedRanges, currentUserId]);

    const handleUndo = useCallback(() => {
        if (historyIndex >= 0) {
            const { inversePatches } = history[historyIndex];
            const nextState = applyPatches(data, inversePatches);
            setData(nextState);
            setHistoryIndex(historyIndex - 1);
            onLocalCellsChange?.(collectPersistedCellUpdates(data, nextState, inversePatches));
            onDataChange?.(nextState);
        }
    }, [data, history, historyIndex, onDataChange, onLocalCellsChange]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const { patches } = history[historyIndex + 1];
            const nextState = applyPatches(data, patches);
            setData(nextState);
            setHistoryIndex(historyIndex + 1);
            onLocalCellsChange?.(collectPersistedCellUpdates(data, nextState, patches));
            onDataChange?.(nextState);
        }
    }, [data, history, historyIndex, onDataChange, onLocalCellsChange]);

    const insertRow = useCallback((rowIndex: number) => {
        applyChange((draft) => {
            // Shift rows down
            // We need to find all rows >= rowIndex and move them to row+1
            // Iterate backwards to avoid overwriting
            const rows = Object.keys(draft).map(Number).sort((a, b) => b - a);
            for (const r of rows) {
                if (r >= rowIndex) {
                    draft[r + 1] = draft[r];
                    delete draft[r];
                }
            }
            // Ensure the new row is empty (it might have been deleted above, or didn't exist)
            draft[rowIndex] = {};
            rewriteFormulas(draft, { axis: 'row', type: 'insert', index: rowIndex });
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, undefined, workbookFor(currentData));
        });
    }, [applyChange, namedRanges, workbookFor]);

    const deleteRow = useCallback((rowIndex: number) => {
        applyChange((draft) => {
            // Delete target row
            if (draft[rowIndex]) delete draft[rowIndex];

            // Shift rows up
            const rows = Object.keys(draft).map(Number).sort((a, b) => a - b);
            for (const r of rows) {
                if (r > rowIndex) {
                    draft[r - 1] = draft[r];
                    delete draft[r];
                }
            }
            rewriteFormulas(draft, { axis: 'row', type: 'delete', index: rowIndex });
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, undefined, workbookFor(currentData));
        });
    }, [applyChange, namedRanges, workbookFor]);

    const insertColumn = useCallback((colIndex: number) => {
        applyChange((draft) => {
            const rows = Object.keys(draft).map(Number);
            for (const r of rows) {
                const rowData = draft[r];
                if (!rowData) continue;

                // Shift cells right
                const cols = Object.keys(rowData).map(Number).sort((a, b) => b - a);
                for (const c of cols) {
                    if (c >= colIndex) {
                        rowData[c + 1] = rowData[c];
                        delete rowData[c];
                    }
                }
            }
            rewriteFormulas(draft, { axis: 'column', type: 'insert', index: colIndex });
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, undefined, workbookFor(currentData));
        });
    }, [applyChange, namedRanges, workbookFor]);

    const deleteColumn = useCallback((colIndex: number) => {
        applyChange((draft) => {
            const rows = Object.keys(draft).map(Number);
            for (const r of rows) {
                const rowData = draft[r];
                if (!rowData) continue;

                // Delete target cell
                if (rowData[colIndex]) delete rowData[colIndex];

                // Shift cells left
                const cols = Object.keys(rowData).map(Number).sort((a, b) => a - b);
                for (const c of cols) {
                    if (c > colIndex) {
                        rowData[c - 1] = rowData[c];
                        delete rowData[c];
                    }
                }
            }
            rewriteFormulas(draft, { axis: 'column', type: 'delete', index: colIndex });
            const currentData = draft as unknown as SheetData;
            recalculate(currentData, namedRanges, undefined, workbookFor(currentData));
        });
    }, [applyChange, namedRanges, workbookFor]);

    return {
        data,
        protectedRanges,
        addProtectedRange: (range: CellRange, allowedUserIds: string[] = []) => {
            if (!currentUserId) throw new Error('로그인이 필요합니다.');
            setProtectedRanges((current) => [...current, {
                id: globalThis.crypto.randomUUID(),
                range,
                ownerId: currentUserId,
                allowedUserIds,
            }]);
        },
        removeProtectedRange: (id: string) => {
            setProtectedRanges((current) => current.filter((item) => item.id !== id || item.ownerId !== currentUserId));
        },
        namedRanges,
        defineNamedRange: (name: string, range: CellRange) => {
            const normalizedName = name.trim().toUpperCase();
            if (!/^[A-Z_][A-Z0-9_.]*$/.test(normalizedName) || /^\$?[A-Z]+\$?[1-9][0-9]*$/.test(normalizedName)) {
                throw new Error('이름은 문자 또는 밑줄로 시작해야 하며 셀 주소와 같을 수 없습니다.');
            }
            const next = { ...namedRanges, [normalizedName]: range };
            setNamedRanges(next);
            setData((currentData) => produce(currentData, (draft) => {
                const currentData = draft as unknown as SheetData;
                recalculate(currentData, next, undefined, workbookFor(currentData));
            }));
        },
        deleteNamedRange: (name: string) => {
            const next = { ...namedRanges };
            delete next[name.toUpperCase()];
            setNamedRanges(next);
            setData((currentData) => produce(currentData, (draft) => {
                const currentData = draft as unknown as SheetData;
                recalculate(currentData, next, undefined, workbookFor(currentData));
            }));
        },
        setData,
        updateData, // External update
        setCellValue,
        updateCells,
        updateCellStyle,
        updateCellValidation: (range: CellRange, validation?: DataValidationRule) => {
            applyChange((draft) => {
                for (let row = range.start.row; row <= range.end.row; row++) {
                    if (!draft[row]) draft[row] = {};
                    for (let col = range.start.col; col <= range.end.col; col++) {
                        if (!canEditCell(protectedRanges, { row, col }, currentUserId)) continue;
                        const current = draft[row][col] ?? { value: null };
                        draft[row][col] = { ...current, validation, error: undefined };
                    }
                }
            });
        },
        updateCellLink: (position: { row: number; col: number }, text: string, url: string) => {
            applyChange((draft) => {
                const { row, col } = position;
                if (!canEditCell(protectedRanges, position, currentUserId)) return;
                if (!draft[row]) draft[row] = {};
                const current = draft[row][col] ?? { value: null };
                draft[row][col] = {
                    ...current,
                    value: text,
                    displayValue: text,
                    formula: undefined,
                    error: undefined,
                    link: { url },
                    style: {
                        ...current.style,
                        color: '#1155cc',
                        textDecoration: 'underline',
                    },
                };
            });
        },
        insertRow,
        deleteRow,
        insertColumn,
        deleteColumn,
        handleUndo,
        handleRedo,
        canUndo: historyIndex >= 0,
        canRedo: historyIndex < history.length - 1,
        history,
        sortRows: useCallback((colIndex: number, ascending: boolean = true) => {
            applyChange((draft) => {
                const currentData = draft as unknown as SheetData;
                sortRowsData(currentData, colIndex, ascending, namedRanges, workbookFor(currentData));
            });
        }, [applyChange, namedRanges, workbookFor]),

        sortRange: useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } }, colIndex: number, ascending: boolean = true) => {
            applyChange((draft) => {
                const currentData = draft as unknown as SheetData;
                sortRangeData(currentData, range, colIndex, ascending, namedRanges, workbookFor(currentData));
            });
        }, [applyChange, namedRanges, workbookFor]),

        removeDuplicates: useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } }) => {
            applyChange((draft) => {
                const startRow = Math.min(range.start.row, range.end.row);
                const endRow = Math.max(range.start.row, range.end.row);
                const minCol = Math.min(range.start.col, range.end.col);
                const maxCol = Math.max(range.start.col, range.end.col);

                const uniqueRows: Record<number, CellData | undefined>[] = [];
                const seen = new Set();

                for (let r = startRow; r <= endRow; r++) {
                    let signature = "";
                    for (let c = minCol; c <= maxCol; c++) {
                        signature += String(draft[r]?.[c]?.value ?? "") + "|";
                    }

                    if (!seen.has(signature)) {
                        seen.add(signature);
                        const cellMap: Record<number, CellData | undefined> = {};
                        for (let c = minCol; c <= maxCol; c++) {
                            cellMap[c] = draft[r]?.[c];
                        }
                        uniqueRows.push(cellMap);
                    }
                }

                // Write back unique rows
                for (let i = 0; i <= (endRow - startRow); i++) {
                    const targetRow = startRow + i;
                    if (!draft[targetRow]) draft[targetRow] = {};

                    if (i < uniqueRows.length) {
                        const cellMap = uniqueRows[i];
                        for (let c = minCol; c <= maxCol; c++) {
                            const cell = cellMap[c];
                            if (cell) draft[targetRow][c] = cell;
                            else delete draft[targetRow][c];
                        }
                    } else {
                        // Clear remaining rows in range
                        for (let c = minCol; c <= maxCol; c++) {
                            if (draft[targetRow][c]) delete draft[targetRow][c];
                        }
                    }
                }
            });
        }, [applyChange]),

        // Find and Replace
        updateCellFormat,
        findNext: useCallback((query: string, matchCase: boolean, startIndex: { row: number, col: number }) => {
            // Return next match position
            const rows = Object.keys(data).map(Number).sort((a, b) => a - b);
            for (const r of rows) {
                const cols = Object.keys(data[r]).map(Number).sort((a, b) => a - b);
                for (const c of cols) {
                    // simple scan, can be optimized to start from index
                    if (r < startIndex.row || (r === startIndex.row && c <= startIndex.col)) continue;

                    const val = String(data[r][c]?.value ?? '');
                    const target = matchCase ? query : query.toLowerCase();
                    const source = matchCase ? val : val.toLowerCase();

                    if (source.includes(target)) {
                        return { row: r, col: c };
                    }
                }
            }
            return null; // wrap around?
        }, [data]),

        replaceAll: useCallback((query: string, replacement: string, matchCase: boolean) => {
            applyChange((draft) => {
                const rows = Object.keys(draft).map(Number);
                for (const r of rows) {
                    const cols = Object.keys(draft[r]).map(Number);
                    for (const c of cols) {
                        const cell = draft[r][c];
                        if (!cell) continue;
                        const val = String(cell.value ?? '');

                        const target = matchCase ? query : query.toLowerCase();
                        const source = matchCase ? val : val.toLowerCase();

                        if (source.includes(target)) {
                            // Simple replace or regex? Simple include check implies simple replace
                            // But if we want exact replace behavior similar to 'includes':
                            if (matchCase) {
                                cell.value = val.replaceAll(query, replacement);
                            } else {
                                // case insensitive replace all
                                const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                                cell.value = val.replace(re, replacement);
                            }
                        }
                    }
                }
            });
        }, [applyChange]),

        // Table Formatting
        applyTableFormat: useCallback((
            range: { start: { row: number, col: number }, end: { row: number, col: number } } | null,
            config: {
                headerBg: string;
                headerColor: string;
                headerBold: boolean;
                oddRowBg: string;
                evenRowBg: string;
                textColor: string;
                hasHeader: boolean;
                alternatingColors: boolean;
            }
        ) => {
            if (!range) return;

            applyChange((draft) => {
                for (let row = range.start.row; row <= range.end.row; row++) {
                    for (let col = range.start.col; col <= range.end.col; col++) {
                        if (!draft[row]) draft[row] = {};

                        const dataRowIndex = config.hasHeader ? row - range.start.row - 1 : row - range.start.row;
                        const isHeader = config.hasHeader && row === range.start.row;
                        const isEvenRow = dataRowIndex >= 0 && dataRowIndex % 2 === 1;

                        let backgroundColor: string;
                        let color: string;
                        let fontWeight: 'normal' | 'bold' = 'normal';

                        if (isHeader) {
                            backgroundColor = config.headerBg;
                            color = config.headerColor;
                            fontWeight = config.headerBold ? 'bold' : 'normal';
                        } else if (config.alternatingColors) {
                            backgroundColor = isEvenRow ? config.evenRowBg : config.oddRowBg;
                            color = config.textColor;
                        } else {
                            backgroundColor = config.oddRowBg;
                            color = config.textColor;
                        }

                        const existingStyle = draft[row][col]?.style || {};
                        const newStyle: CellStyle = {
                            ...existingStyle,
                            backgroundColor,
                            color,
                            fontWeight,
                        };

                        if (!draft[row][col]) {
                            draft[row][col] = { value: null, style: newStyle };
                        } else {
                            draft[row][col]!.style = newStyle;
                        }
                    }
                }
            });
        }, [applyChange]),
    };
}
