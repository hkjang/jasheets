import { useState, useCallback } from 'react';
import { SheetData, CellStyle } from '@/types/spreadsheet';
import { produce, applyPatches, Patch, enablePatches } from 'immer';
import FormulaEngine, { EvaluationContext, CellReference, CellValue } from '@jasheets/formula-engine';

enablePatches();

const formulaEngine = new FormulaEngine();

interface Commit {
  patches: Patch[];
  inversePatches: Patch[];
}

interface UseSpreadsheetDataProps {
  initialData?: SheetData;
  onDataChange?: (data: SheetData) => void;
}

export function useSpreadsheetData({ initialData = {}, onDataChange }: UseSpreadsheetDataProps) {
  const [data, setData] = useState<SheetData>(initialData);
  const [history, setHistory] = useState<Commit[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Update data if initialData changes (e.g. loaded from server)
  // We check if data is currently empty/default and initialData is populated to avoid overwriting user edits
  // deep equality check is expensive, assume props change implies update needed if we are in "loading" phase
  // But wait, if we are editing, we don't want to reset?
  // Use a ref to track if we are "dirty"?
  // Or simply: if initialData changes, we assume it's a "load" event from parent.
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (initialData !== prevInitialData) {
      setData(initialData);
      setPrevInitialData(initialData);
  }

  // Helper to apply changes and record history
  const applyChange = useCallback((recipe: (draft: SheetData) => void) => {
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
    }
    
    onDataChange?.(nextState);
  }, [data, historyIndex, onDataChange]);

  // Direct update without history (e.g. from server)
  const updateData = useCallback((newData: SheetData) => {
      setData(newData);
      // We might want to clear history or push a full replace patch? 
      // For now, let's assume external updates clear/reset history or are just applied.
      // If we want to support undoing external changes, we need to diff.
      // Simplest for collaboration: just update state, don't mess with local history stack too much or reset it.
      // Let's reset history to avoid conflicts.
      // setHistory([]);
      // setHistoryIndex(-1);
  }, []);

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    applyChange((draft) => {
        if (!draft[row]) draft[row] = {};
        
        // Check if value is formula
        const isFormula = value.startsWith('=');
        let displayValue = value;
        let error: string | undefined;

        if (isFormula) {
            try {
                const context: EvaluationContext = {
                    getCellValue: (ref: CellReference): CellValue => {
                       return draft[ref.row]?.[ref.col]?.value ?? 0;
                    },
                    getRangeValues: (start: CellReference, end: CellReference): CellValue[][] => {
                        const result: CellValue[][] = [];
                        for (let r = start.row; r <= end.row; r++) {
                            const rowArr: CellValue[] = [];
                            for (let c = start.col; c <= end.col; c++) {
                                rowArr.push(draft[r]?.[c]?.value ?? 0);
                            }
                            result.push(rowArr);
                        }
                        return result;
                    }
                };
                
                // formulaEngine.evaluate handles the parsing and execution
                // We pass the raw formula (e.g. "=SUM(A1:B2)")
                const result = formulaEngine.evaluate(value, context);
                displayValue = String(result);
            } catch (e) {
                displayValue = '#ERROR!';
                error = e instanceof Error ? e.message : 'Formula error';
            }
        }

        const numValue = !isFormula && !isNaN(parseFloat(value)) ? parseFloat(value) : value;

        draft[row][col] = {
            value: numValue,
            displayValue: isFormula ? displayValue : undefined,
            formula: isFormula ? value : undefined,
            error,
            style: draft[row][col]?.style,
        };
    });
  }, [applyChange]);

  const updateCellStyle = useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } } | null, styleUpdate: Partial<CellStyle>) => {
    if (!range) return;
    
    applyChange((draft) => {
        for (let row = range.start.row; row <= range.end.row; row++) {
            for (let col = range.start.col; col <= range.end.col; col++) {
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
  }, [applyChange]);

  const handleUndo = useCallback(() => {
    if (historyIndex >= 0) {
      const { inversePatches } = history[historyIndex];
      const nextState = applyPatches(data, inversePatches);
      setData(nextState);
      setHistoryIndex(historyIndex - 1);
      onDataChange?.(nextState);
    }
  }, [data, history, historyIndex, onDataChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const { patches } = history[historyIndex + 1];
      const nextState = applyPatches(data, patches);
      setData(nextState);
      setHistoryIndex(historyIndex + 1);
      onDataChange?.(nextState);
    }
  }, [data, history, historyIndex, onDataChange]);

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
    });
  }, [applyChange]);

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
      });
  }, [applyChange]);

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
      });
  }, [applyChange]);

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
      });
  }, [applyChange]);

  return {
    data,
    setData, 
    updateData, // External update
    setCellValue,
    updateCellStyle,
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
             // ... existing sort logic ...
            // 1. Get all row indices
            const rowIndices = Object.keys(draft).map(Number).filter(r => !isNaN(r));
            if (rowIndices.length === 0) return;
            const minRow = Math.min(...rowIndices);
            const maxRow = Math.max(...rowIndices);
            
            const rowsToSort = [];
            for (let r = minRow; r <= maxRow; r++) {
               rowsToSort.push({ index: r, data: draft[r] });
            }
            
            rowsToSort.sort((a, b) => {
                const valA = a.data?.[colIndex]?.value;
                const valB = b.data?.[colIndex]?.value;
                if (valA === valB) return 0;
                if (valA === null || valA === undefined) return 1; 
                if (valB === null || valB === undefined) return -1;
                if (valA < valB) return ascending ? -1 : 1;
                if (valA > valB) return ascending ? 1 : -1;
                return 0;
            });
            
            rowsToSort.forEach((item, i) => {
                const targetRowIndex = minRow + i;
                draft[targetRowIndex] = item.data;
            });
        });
    }, [applyChange]),

    // Find and Replace
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
  };
}
