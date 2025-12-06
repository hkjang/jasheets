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

  return {
    data,
    setData, 
    updateData, // External update
    setCellValue,
    updateCellStyle,
    handleUndo,
    handleRedo,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,
  };
}
