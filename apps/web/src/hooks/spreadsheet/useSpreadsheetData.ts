import { useState, useCallback, useEffect } from 'react';
import { SheetData, CellStyle } from '@/types/spreadsheet';
import { produce, applyPatches, Patch, enablePatches } from 'immer';
// Use local FormulaEngine
import { evaluateFormula } from '@/utils/FormulaEngine';
import { formatValue } from '@/utils/formatting';
import { parseInput } from '@/utils/inputParser';
import { recalculate } from '@/utils/RecalculationEngine';

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
}

export function useSpreadsheetData({ initialData = {}, onDataChange }: UseSpreadsheetDataProps) {
  const [data, setData] = useState<SheetData>(initialData);
  const [history, setHistory] = useState<Commit[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Update data if initialData changes (e.g. loaded from server)
  // Update data if initialData changes (e.g. loaded from server)
  useEffect(() => {
    if (initialData) { // Only update if we have data
        setData(initialData);
    }
  }, [initialData]);

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
  }, []);

  const setCellValue = useCallback((row: number, col: number, value: string) => {
    applyChange((draft) => {
        if (!draft[row]) draft[row] = {};
        
        // Check if value is formula
        const isFormula = value.startsWith('=');
        let displayValue = value;
        let error: string | undefined;
        let numValue: number | string | boolean | null = value;
        let detectedFormat: string | undefined;

        // Retrieve existing format
        const currentFormat = draft[row][col]?.format || 'general';

        if (isFormula) {
            try {
                // ... formula eval ...
                const result = evaluateFormula(value, draft as unknown as SheetData);
                // Apply format to result
                if (typeof result === 'number') {
                     displayValue = formatValue(result, currentFormat);
                } else {
                     displayValue = String(result);
                }
                numValue = result; 
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
        };

        // Trigger Recalculation
        recalculate(draft);
    });
  }, [applyChange]);

  const updateCells = useCallback((updates: { row: number; col: number; value: string }[]) => {
      applyChange((draft) => {
          updates.forEach(({ row, col, value }) => {
              if (!draft[row]) draft[row] = {};
              
              const isFormula = value.startsWith('=');
              let displayValue = value;
              let error: string | undefined;
              let numValue: number | string | boolean | null = value;
              let detectedFormat: string | undefined;
              
              const currentFormat = draft[row][col]?.format || 'general';
              
              if (isFormula) {
                   try {
                       const result = evaluateFormula(value, draft as unknown as SheetData);
                       if (typeof result === 'number') {
                            displayValue = formatValue(result, currentFormat);
                       } else {
                            displayValue = String(result);
                       }
                       numValue = result;
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
              };
          });
          recalculate(draft);
      });
  }, [applyChange]);

  const updateCellFormat = useCallback((range: { start: { row: number, col: number }, end: { row: number, col: number } } | null, format: string) => {
    if (!range) return;
    
    applyChange((draft) => {
        for (let row = range.start.row; row <= range.end.row; row++) {
            for (let col = range.start.col; col <= range.end.col; col++) {
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
    updateCells,
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
  };
}
