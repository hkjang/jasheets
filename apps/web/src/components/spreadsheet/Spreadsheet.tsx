'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SpreadsheetCanvas from './SpreadsheetCanvas';
import CellEditor from './CellEditor';
import FormulaBar from './FormulaBar';
import Toolbar from './Toolbar';
import { UserCursors, ChatPanel, CommentsPanel } from '../collaboration';
import AIAssistant from './AIAssistant';
import SmartAutocomplete from './SmartAutocomplete';
import { ChartDialog } from '../charts';
import ChartOverlay from '../charts/ChartOverlay';
import VersionHistorySidebar from './VersionHistorySidebar';
import ConditionalFormattingDialog, { ConditionalRule } from './ConditionalFormattingDialog';
import FindDialog from './FindDialog';

// ... (in Spreadsheet component)


import PivotTableDialog from './PivotTableDialog';
import { calculatePivotData, PivotConfig } from '@/utils/pivotLogic';
import KeyboardShortcuts from './KeyboardShortcuts';
import Toast from '../ui/Toast';
import ShareDialog from './ShareDialog';
import HeaderContextMenu from './HeaderContextMenu';
import {
  CellPosition,
  CellRange,
  SheetData,
  ColumnDef,
  RowDef,
  DEFAULT_CONFIG,
} from '@/types/spreadsheet';
import styles from './Spreadsheet.module.css';
import { useSpreadsheetData } from '@/hooks/spreadsheet/useSpreadsheetData';
import { useSpreadsheetView } from '@/hooks/spreadsheet/useSpreadsheetView';
import { useSpreadsheetSelection } from '@/hooks/spreadsheet/useSpreadsheetSelection';
import { useSpreadsheetEdit } from '@/hooks/spreadsheet/useSpreadsheetEdit';
import { useKeyboardNavigation } from '@/hooks/spreadsheet/useKeyboardNavigation';
import { useSpreadsheetCollaboration } from '@/hooks/spreadsheet/useSpreadsheetCollaboration';
import { useSpreadsheetCharts } from '@/hooks/spreadsheet/useSpreadsheetCharts';
import MenuBar from './MenuBar';
import { exportToCSV } from '@/utils/export';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { api } from '@/lib/api';
import EmailDialog from './EmailDialog';
import FileOpenDialog from './FileOpenDialog';
import { ImportResult } from '@/utils/fileImport';
import { useComments } from '@/hooks/useComments';
import WorkflowManager from '../dashboard/WorkflowManager';

interface SpreadsheetProps {
  initialData?: SheetData;
  initialCharts?: any[];
  onDataChange?: (data: SheetData) => void;
  spreadsheetId?: string;
  activeSheetId?: string | null;
  title?: string;
}

export default function Spreadsheet({ initialData = {}, initialCharts = [], onDataChange, spreadsheetId, activeSheetId, title = 'Untitled Spreadsheet' }: SpreadsheetProps) {
  const [sheetTitle, setSheetTitle] = useState(title);

  // Update title if prop changes (e.g. loaded from server)
  useEffect(() => {
    if (title) setSheetTitle(title);
  }, [title]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setSheetTitle(newTitle);
    if (spreadsheetId) {
      try {
        await api.spreadsheets.update(spreadsheetId, { name: newTitle });
      } catch (e) {
        console.error('Failed to update title', e);
        setToastMessage('Failed to save title');
      }
    }
  }, [spreadsheetId]);

  // --- Custom Hooks ---

  // Data & History
  const {
    data,
    setData,
    updateData,
    setCellValue,
    updateCellStyle,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    history,
    sortRows,
    findNext,
    replaceAll,
    updateCellFormat,
    updateCells,
  } = useSpreadsheetData({ initialData, onDataChange });

  // Selection
  const {
    selectedCell,
    setSelectedCell,
    selection,
    setSelection,
    handleCellSelect: _handleCellSelect,
    handleSelectionChange: _handleSelectionChange,
  } = useSpreadsheetSelection();

  // Editing
  const {
    isEditing,
    isEditingRef,
    editValue,
    setEditValue,
    setEditing,
    startEditing,
    commitEditing,
    cancelEditing,
  } = useSpreadsheetEdit({ data, selectedCell, setCellValue });

  // --- Clipboard Handling ---
  const copyToClipboard = useCallback(async () => {
    if (!selection) return;

    const rows = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      const rowData = [];
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const val = data[r]?.[c]?.value;
        rowData.push(val === null || val === undefined ? '' : String(val));
      }
      rows.push(rowData.join('\t'));
    }
    const text = rows.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setToastMessage('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  }, [data, selection]);

  const cutoffToClipboard = useCallback(async () => {
    if (!selection) return;

    // Copy first
    await copyToClipboard();

    // Execute delete
    const updates: { row: number; col: number; value: string }[] = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        updates.push({ row: r, col: c, value: '' });
      }
    }
    updateCells(updates);
  }, [selection, copyToClipboard, updateCells]);

  const pasteFromClipboard = useCallback(async () => {
    if (!selectedCell) return;

    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const rows = text.split(/\r\n|\n|\r/);
      const updates: { row: number; col: number; value: string }[] = [];

      rows.forEach((rowStr, rIdx) => {
        if (rIdx === rows.length - 1 && rowStr === '') return;
        const cols = rowStr.split('\t');
        cols.forEach((val, cIdx) => {
          updates.push({
            row: selectedCell.row + rIdx,
            col: selectedCell.col + cIdx,
            value: val
          });
        });
      });

      if (updates.length > 0) {
        updateCells(updates);
      }
    } catch (err) {
      console.error('Failed to paste', err);
      // Fallback or alert? 
      // Often triggered if permission denied or not focused
      alert('Failed to paste from clipboard. Please allow clipboard access.');
    }
  }, [selectedCell, updateCells]);

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!selection) return;
      e.preventDefault();
      copyToClipboard();
    };

    const handleCut = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!selection) return;
      e.preventDefault();
      cutoffToClipboard();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!selectedCell) return;
      e.preventDefault();

      // For paste event, we can access data directly which is better than readText() permission-wise within the event
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        // Reuse logic? Or just duplicate the parsing for the event version?
        // The event version is synchronous and doesn't need promise.
        // Let's just use the logic inline effectively or refactor parsing.
        // Refactoring parsing to separate function is cleaner but for now let's just duplicate the parsing logic
        // or updates logic.

        const rows = text.split(/\r\n|\n|\r/);
        const updates: { row: number; col: number; value: string }[] = [];
        rows.forEach((rowStr, rIdx) => {
          if (rIdx === rows.length - 1 && rowStr === '') return;
          const cols = rowStr.split('\t');
          cols.forEach((val, cIdx) => {
            updates.push({
              row: selectedCell.row + rIdx,
              col: selectedCell.col + cIdx,
              value: val
            });
          });
        });
        if (updates.length > 0) updateCells(updates);
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
    };
  }, [selection, selectedCell, copyToClipboard, cutoffToClipboard, updateCells]);

  // Collaboration
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isEmailOpen, setIsEmailOpen] = useState(false);

  const userId = useMemo(() => user?.id || 'guest', [user]);
  const userName = useMemo(() => user?.name || user?.email || 'Guest', [user]);

  const {
    users,
    chatMessages,
    isChatOpen,
    unreadCount,
    toggleChat,
    sendChatMessage,
  } = useSpreadsheetCollaboration({
    userId,
    userName,
    selectedCell,
    selection,
    setData,
    spreadsheetId: spreadsheetId || 'demo-sheet',
  });

  // Charts
  const {
    charts,
    setCharts,
    isChartDialogOpen,
    setIsChartDialogOpen,
    handleAddChart,
    handleInsertChart,
    handleUpdateChart,
    handleRemoveChart,
  } = useSpreadsheetCharts();

  // Initialize charts from props when component mounts
  useEffect(() => {
    if (initialCharts && initialCharts.length > 0) {
      setCharts(initialCharts);
    }
  }, [initialCharts, setCharts]);

  // Save handler - defined after charts to access chart state
  const handleSave = useCallback(async () => {
    if (!activeSheetId) {
      alert('저장할 시트가 없습니다.');
      return;
    }
    try {
      const updates: any[] = [];
      Object.keys(data).forEach(r => {
        const row = Number(r);
        Object.keys(data[row]).forEach(c => {
          const col = Number(c);
          const cell = data[row][col];
          if (cell) {
            updates.push({
              row,
              col,
              value: cell.value,
              formula: cell.formula,
              format: cell.style
            });
          }
        });
      });

      // Save cells
      if (updates.length > 0) {
        await api.spreadsheets.updateCells(activeSheetId, updates);
      }

      // Save charts
      if (charts.length > 0) {
        await api.spreadsheets.saveCharts(activeSheetId, charts);
      }

      setToastMessage('저장되었습니다.');
    } catch (e) {
      console.error(e);
      setToastMessage('저장 중 오류가 발생했습니다.');
    }
  }, [data, activeSheetId, charts]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setIsFileDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Columns & Rows
  // View State using new hook
  const {
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
    hideRow,
    unhideRow,
    hideColumn,
    unhideColumn,
  } = useSpreadsheetView();

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'row' | 'col';
    index: number;
  } | null>(null);

  const handleHeaderContextMenu = useCallback((x: number, y: number, type: 'row' | 'col', index: number) => {
    setContextMenu({ x, y, type, index });
  }, []);

  const handleInsertRowBefore = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'row') return;
    const index = contextMenu.index;
    setRows(prev => {
      const newRows = [...prev];
      newRows.splice(index, 0, { height: DEFAULT_CONFIG.defaultRowHeight });
      return newRows;
    });
    insertRow(index);
    setContextMenu(null);
  }, [contextMenu, insertRow]);

  const handleInsertRowAfter = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'row') return;
    const index = contextMenu.index + 1;
    setRows(prev => {
      const newRows = [...prev];
      newRows.splice(index, 0, { height: DEFAULT_CONFIG.defaultRowHeight });
      return newRows;
    });
    insertRow(index);
    setContextMenu(null);
  }, [contextMenu, insertRow]);

  const handleDeleteRow = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'row') return;
    const index = contextMenu.index;
    setRows(prev => {
      const newRows = [...prev];
      newRows.splice(index, 1);
      newRows.push({ height: DEFAULT_CONFIG.defaultRowHeight });
      return newRows;
    });
    deleteRow(index);
    setContextMenu(null);
  }, [contextMenu, deleteRow]);

  const handleHideRow = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'row') return;
    const index = contextMenu.index;
    setRows(prev => {
      const newRows = [...prev];
      if (newRows[index]) newRows[index] = { ...newRows[index], hidden: true };
      return newRows;
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleUnhideRow = useCallback(() => {
    // Logic: If user specifically clicked a hidden row placeholder? 
    // Or we unhide all in selection?
    // For now, let's implement a simple "Unhide all rows" or unhide specific if we can target it.
    // But context menu is usually on visible headers.
    // Typical UX: Select Row 2 and 4 (where 3 is hidden), right click -> Unhide.
    // Or right click on the boundary marker.
    // Simplified: If context menu is on a row, we check if there are hidden rows nearby?
    // Let's rely on selection-based unhide if implemented.
    // Or just a global unhide for the current selection range if it exists?

    // Let's assume for this step we might pass "Unhide" for the current selection if it spans hidden rows.
    if (!contextMenu || contextMenu.type !== 'row') return;

    // If we have a selection that includes hidden rows, unhide them. 
    // Otherwise, check if adjacent rows are hidden?
    // Simple MVP: Unhide ALL hidden rows in the current selection range, or globally if no selection?
    // Let's do: Unhide rows adjacent to current index?
    // Or just unhide the specific index if we could somehow right-click it (not possible if hidden).
    // Standard Excel: Select range covering hidden rows -> Right Click -> Unhide.

    if (selection && selection.start.row <= contextMenu.index && selection.end.row >= contextMenu.index) {
      const start = Math.min(selection.start.row, selection.end.row);
      const end = Math.max(selection.end.row, selection.start.row);
      setRows(prev => {
        const newRows = [...prev];
        for (let i = start; i <= end; i++) {
          if (newRows[i]?.hidden) {
            newRows[i] = { ...newRows[i], hidden: false };
          }
        }
        return newRows;
      });
    }
    setContextMenu(null);
  }, [contextMenu, selection]);


  const handleInsertColBefore = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'col') return;
    const index = contextMenu.index;
    setColumns(prev => {
      const newCols = [...prev];
      newCols.splice(index, 0, { width: DEFAULT_CONFIG.defaultColWidth });
      return newCols;
    });
    insertColumn(index);
    setContextMenu(null);
  }, [contextMenu, insertColumn]);

  const handleInsertColAfter = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'col') return;
    const index = contextMenu.index + 1;
    setColumns(prev => {
      const newCols = [...prev];
      newCols.splice(index, 0, { width: DEFAULT_CONFIG.defaultColWidth });
      return newCols;
    });
    insertColumn(index);
    setContextMenu(null);
  }, [contextMenu, insertColumn]);

  const handleDeleteCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'col') return;
    const index = contextMenu.index;
    setColumns(prev => {
      const newCols = [...prev];
      newCols.splice(index, 1);
      newCols.push({ width: DEFAULT_CONFIG.defaultColWidth });
      return newCols;
    });
    deleteColumn(index);
    setContextMenu(null);
  }, [contextMenu, deleteColumn]);

  const handleHideCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'col') return;
    const index = contextMenu.index;
    setColumns(prev => {
      const newCols = [...prev];
      if (newCols[index]) newCols[index] = { ...newCols[index], hidden: true };
      return newCols;
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleUnhideCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== 'col') return;
    if (selection && selection.start.col <= contextMenu.index && selection.end.col >= contextMenu.index) {
      const start = Math.min(selection.start.col, selection.end.col);
      const end = Math.max(selection.end.col, selection.start.col);
      setColumns(prev => {
        const newCols = [...prev];
        for (let i = start; i <= end; i++) {
          if (newCols[i]?.hidden) {
            newCols[i] = { ...newCols[i], hidden: false };
          }
        }
        return newCols;
      });
    }
    setContextMenu(null);
  }, [contextMenu, selection]);



  const getCellPosition = useCallback((row: number, col: number) => {
    let x = 50;
    for (let c = 0; c < col; c++) x += columns[c]?.width || DEFAULT_CONFIG.defaultColWidth;
    let y = 30;
    for (let r = 0; r < row; r++) y += rows[r]?.height || DEFAULT_CONFIG.defaultRowHeight;
    const width = columns[col]?.width || DEFAULT_CONFIG.defaultColWidth;
    const height = rows[row]?.height || DEFAULT_CONFIG.defaultRowHeight;
    return { x, y, width, height };
  }, [columns, rows]);

  // Wrap selection handlers
  const handleCellSelect = useCallback((pos: CellPosition) => {
    if (!pos) return;

    // Check if we are re-selecting the currently edited cell
    if (isEditing && selectedCell && selectedCell.row === pos.row && selectedCell.col === pos.col) {
      return;
    }

    // Auto-commit if moving to another cell while editing
    if (isEditing) {
      commitEditing();
    }

    _handleCellSelect(pos);

    const cell = data[pos.row]?.[pos.col];
    setEditValue(cell?.formula || String(cell?.value ?? ''));
  }, [_handleCellSelect, setEditValue, data, isEditing, selectedCell, commitEditing]);

  const handleSelectionChange = useCallback((range: CellRange) => {
    _handleSelectionChange(range);
  }, [_handleSelectionChange]);

  // Keyboard Navigation
  useKeyboardNavigation({
    selectedCell,
    selection,
    isEditingRef,
    onCommit: commitEditing,
    onCancel: cancelEditing,
    onStartEdit: (val) => selectedCell && startEditing(selectedCell, val),
    onNavigate: (row, col) => {
      handleCellSelect({ row, col });
      setSelection({ start: { row, col }, end: { row, col } });
    },
    onClearSelection: () => {
      if (!selection) return;
      const newData = { ...data };
      for (let row = selection.start.row; row <= selection.end.row; row++) {
        for (let col = selection.start.col; col <= selection.end.col; col++) {
          if (newData[row]?.[col]) {
            newData[row][col] = { value: null, style: newData[row][col].style };
          }
        }
      }
      updateData(newData);
    },
    totalRows: DEFAULT_CONFIG.totalRows,
    totalCols: DEFAULT_CONFIG.totalCols,
  });

  // --- Other States (Features) ---

  // Conditional Formatting state
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([]);
  const [isConditionalDialogOpen, setIsConditionalDialogOpen] = useState(false);

  // Pivot Table state
  const [isPivotDialogOpen, setIsPivotDialogOpen] = useState(false);

  // Keyboard Shortcuts state
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Share Dialog state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Version History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Find Dialog state
  const [isFindOpen, setIsFindOpen] = useState(false);

  // File Open Dialog state
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);

  // Comments Panel state
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // AI Assistant state
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Workflow Manager state
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);

  // Zoom state for menu
  const [zoom, setZoom] = useState(100);

  // Link Dialog state
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  // Handler for clearing all freeze (rows and columns)
  const handleUnfreeze = useCallback(() => {
    setConfig(prev => ({ ...prev, frozenRows: 0, frozenCols: 0 }));
    setToastMessage('모든 고정이 해제되었습니다.');
  }, [setConfig]);

  // Handler for zoom change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    // Apply zoom via CSS transform would require more changes to the grid
    document.documentElement.style.setProperty('--spreadsheet-zoom', `${newZoom / 100}`);
    setToastMessage(`확대/축소: ${newZoom}%`);
  }, []);

  // Handler for trim whitespace on selected cells
  const handleTrimWhitespace = useCallback(() => {
    if (!selection) {
      alert('공백을 제거할 범위를 선택해주세요.');
      return;
    }
    const updates: { row: number; col: number; value: string }[] = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const val = data[r]?.[c]?.value;
        if (typeof val === 'string') {
          updates.push({ row: r, col: c, value: val.trim() });
        }
      }
    }
    if (updates.length > 0) {
      updateCells(updates);
      setToastMessage('공백이 제거되었습니다.');
    }
  }, [selection, data, updateCells]);

  // Comments hook
  const {
    comments,
    addComment,
    replyToComment,
    resolveComment,
    deleteComment,
  } = useComments({ sheetId: activeSheetId || null });


  const handleShare = useCallback(async () => {
    if (spreadsheetId) {
      setIsShareDialogOpen(true);
    } else {
      // Fallback for demo/unsaved sheets
      try {
        await navigator.clipboard.writeText(window.location.href);
        setToastMessage('Link copied to clipboard (Unsaved sheet)');
      } catch (err) {
        setToastMessage('Failed to copy link');
      }
    }
  }, [spreadsheetId]);

  // Handle file import
  const handleFileImport = useCallback((result: ImportResult) => {
    setData(result.data);
    if (result.sheetName && !spreadsheetId) {
      setSheetTitle(result.sheetName);
    }
    setToastMessage(`"${result.sheetName}" 파일을 불러왔습니다.`);
  }, [spreadsheetId]);

  // Derived
  const currentCell = useMemo(() => {
    if (!selectedCell) return null;
    return data[selectedCell.row]?.[selectedCell.col] ?? null;
  }, [data, selectedCell]);

  const currentStyle = useMemo(() => {
    return currentCell?.style ?? {};
  }, [currentCell]);

  // Keyboard shortcuts (Help & Toolbar Actions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Shortcuts Help with Ctrl+/
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        setIsShortcutsOpen(prev => !prev);
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.shiftKey ? handleRedo() : handleUndo();
            e.preventDefault();
            break;
          case 'y':
            handleRedo();
            e.preventDefault();
            break;
          case 'b':
            updateCellStyle(selection, { fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' });
            e.preventDefault();
            break;
          case 'i':
            updateCellStyle(selection, { fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' });
            e.preventDefault();
            break;
          case 'u':
            updateCellStyle(selection, { textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline' });
            e.preventDefault();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, updateCellStyle, currentStyle, selection]);

  const selectedData = useMemo(() => {
    if (!selection) return [];
    const result = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      const rowData = [];
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const cell = data[r]?.[c];
        rowData.push(cell?.value ?? '');
      }
      result.push(rowData);
    }
    return result;
  }, [data, selection]);

  // Find Handlers
  const handleFind = useCallback((query: string, matchCase: boolean) => {
    const start = selectedCell || { row: -1, col: -1 };
    const next = findNext(query, matchCase, start);
    if (next) {
      _handleCellSelect(next);
    } else {
      const nextWrap = findNext(query, matchCase, { row: -1, col: -1 });
      if (nextWrap) {
        _handleCellSelect(nextWrap);
      } else {
        alert('검색 결과가 없습니다.');
      }
    }
  }, [findNext, selectedCell, _handleCellSelect]);

  const handleReplace = useCallback((query: string, replacement: string, matchCase: boolean) => {
    if (!selectedCell) {
      handleFind(query, matchCase);
      return;
    }

    const val = String(currentCell?.value ?? '');
    const target = matchCase ? query : query.toLowerCase();
    const source = matchCase ? val : val.toLowerCase();

    if (source.includes(target)) {
      if (matchCase) {
        setCellValue(selectedCell.row, selectedCell.col, val.replace(query, replacement));
      } else {
        const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        // Replace only first?
        setCellValue(selectedCell.row, selectedCell.col, val.replace(re, replacement));
      }
      handleFind(query, matchCase);
    } else {
      handleFind(query, matchCase);
    }
  }, [selectedCell, currentCell, handleFind, setCellValue]);

  // Feature Handlers
  const handleAddConditionalRule = useCallback((rule: ConditionalRule) => {
    setConditionalRules(prev => [...prev, rule]);
  }, []);

  const handleOpenConditionalDialog = useCallback(() => {
    if (selection) {
      setIsConditionalDialogOpen(true);
    } else {
      alert('먼저 범위를 선택해주세요.');
    }
  }, [selection]);

  const handleOpenPivotDialog = useCallback(() => {
    if (selection) {
      setIsPivotDialogOpen(true);
    } else {
      alert('데이터가 있는 범위를 먼저 선택해주세요.');
    }
  }, [selection]);

  const handleCreatePivot = useCallback((config: PivotConfig) => {
    const pivotData = calculatePivotData(data, config);
    const usedRows = Object.keys(data).map(Number);
    const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : -1;
    const startTargetRow = maxRow + 5;

    const newData = { ...data };
    Object.keys(pivotData).forEach(rIdx => {
      const r = Number(rIdx);
      const targetRow = startTargetRow + r;
      if (!newData[targetRow]) newData[targetRow] = {};
      Object.keys(pivotData[r]).forEach(cIdx => {
        const c = Number(cIdx);
        newData[targetRow][c] = pivotData[r][c];
      });
    });
    updateData(newData);
  }, [data, updateData]);

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <MenuBar
        onExportCSV={() => exportToCSV(data, `${sheetTitle.trim() || 'spreadsheet'}.csv`)}
        onDownloadXLSX={() => {
          const rows = Object.keys(data).map(Number).sort((a, b) => a - b);
          const maxRow = rows.length ? rows[rows.length - 1] : 0;
          const maxCol = 26;
          const aoa = [];
          for (let r = 0; r <= maxRow; r++) {
            const rowData = [];
            for (let c = 0; c < maxCol; c++) {
              rowData.push(data[r]?.[c]?.value ?? '');
            }
            aoa.push(rowData);
          }
          const wb = XLSX.utils.book_new();
          const wsFull = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, wsFull, "Sheet1");
          XLSX.writeFile(wb, `${sheetTitle.trim() || 'spreadsheet'}.xlsx`);
        }}
        onDownloadPDF={() => {
          const doc = new jsPDF();
          const rows = Object.keys(data).map(Number).sort((a, b) => a - b);
          const maxRow = rows.length ? rows[rows.length - 1] : 0;
          const maxCol = 10;
          const body = [];
          for (let r = 0; r <= maxRow; r++) {
            const rowData = [];
            for (let c = 0; c < maxCol; c++) {
              rowData.push(String(data[r]?.[c]?.value ?? ''));
            }
            body.push(rowData);
          }
          autoTable(doc, {
            head: [],
            body: body,
          });
          doc.save(`${sheetTitle.trim() || 'spreadsheet'}.pdf`);
        }}
        onMakeCopy={async () => {
          if (!spreadsheetId) {
            alert('저장된 시트만 복사할 수 있습니다.');
            return;
          }
          try {
            const newSheet = await api.spreadsheets.copy(spreadsheetId);
            if (confirm('복사가 완료되었습니다. 복사된 시트로 이동하시겠습니까?')) {
              router.push(`/spreadsheet/${newSheet.id}`);
            }
          } catch (e) {
            alert('오류가 발생했습니다.');
          }
        }}
        onSave={handleSave}
        title={sheetTitle}
        onTitleChange={handleTitleChange}
        onPrint={() => window.print()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={cutoffToClipboard}
        onCopy={copyToClipboard}
        onPaste={pasteFromClipboard}
        onFind={() => setIsFindOpen(true)}
        onShowShortcuts={() => setIsShortcutsOpen(true)}
        onVersionHistory={() => setIsHistoryOpen(true)}
        onInsertRow={() => { if (selectedCell) insertRow(selectedCell.row); }}
        onInsertCol={() => { if (selectedCell) insertColumn(selectedCell.col); }}
        onDeleteRow={() => { if (selectedCell) deleteRow(selectedCell.row); }}
        onDeleteCol={() => { if (selectedCell) deleteColumn(selectedCell.col); }}
        onFreezeRow={() => {
          if (selectedCell) {
            handleFreezeRow(selectedCell.row);
          } else {
            alert('고정할 행 아래의 셀을 선택해주세요.');
          }
        }}
        onFreezeCol={() => {
          if (selectedCell) {
            handleFreezeCol(selectedCell.col);
          } else {
            alert('고정할 열 오른쪽의 셀을 선택해주세요.');
          }
        }}
        onFilter={() => {
          if (!selectedCell) {
            if (rows.some(r => r?.hidden)) {
              setRows(prev => prev.map(r => ({ ...r, hidden: false })));
              alert('필터가 해제되었습니다.');
            } else {
              alert('필터를 적용할 셀을 선택해주세요.');
            }
            return;
          }
          const targetValue = data[selectedCell.row]?.[selectedCell.col]?.value;
          const targetCol = selectedCell.col;
          setRows(prev => prev.map((r, i) => {
            const cellValue = data[i]?.[targetCol]?.value;
            if (cellValue !== targetValue) {
              return { ...r, hidden: true };
            }
            return { ...r, hidden: false };
          }));
        }}
        onSort={() => {
          if (selectedCell) {
            sortRows(selectedCell.col, true);
          } else {
            alert('정렬할 열의 셀을 선택해주세요.');
          }
        }}
        onToggleFormulaBar={() => setShowFormulaBar(!showFormulaBar)}
        onToggleGridlines={() => setShowGridlines(!showGridlines)}
        onEmail={() => setIsEmailOpen(true)}
        onOpenFile={() => setIsFileDialogOpen(true)}
        // New props for enhanced menu functionality
        onInsertChart={handleAddChart}
        onInsertPivot={handleOpenPivotDialog}
        onConditionalFormat={handleOpenConditionalDialog}
        onInsertLink={() => alert('링크 삽입 기능은 추후 지원 예정입니다.')}
        onUnfreeze={handleUnfreeze}
        onZoomChange={handleZoomChange}
        onTrimWhitespace={handleTrimWhitespace}
        onFormatNumber={(fmt) => updateCellFormat(selection, fmt)}
        showFormulaBar={showFormulaBar}
        showGridlines={showGridlines}
        zoom={zoom}
      />
      <FileOpenDialog
        isOpen={isFileDialogOpen}
        onClose={() => setIsFileDialogOpen(false)}
        onFileImport={handleFileImport}
      />
      <EmailDialog
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        onSend={(email, subject, message) => {
          alert(`이메일을 보냈습니다! (시뮬레이션)\nTo: ${email}\nSubject: ${subject}\nMsg: ${message}`);
          setIsEmailOpen(false);
        }}
      />
      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBold={() => updateCellStyle(selection, { fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
        onItalic={() => updateCellStyle(selection, { fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
        onUnderline={() => updateCellStyle(selection, { textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline' })}
        onAlignLeft={() => updateCellStyle(selection, { textAlign: 'left' })}
        onAlignCenter={() => updateCellStyle(selection, { textAlign: 'center' })}
        onAlignRight={() => updateCellStyle(selection, { textAlign: 'right' })}
        onFormat={(fmt) => updateCellFormat(selection, fmt)}
        canUndo={canUndo}
        canRedo={canRedo}
        isBold={currentStyle.fontWeight === 'bold'}
        isItalic={currentStyle.fontStyle === 'italic'}
        isUnderline={currentStyle.textDecoration === 'underline'}
        alignment={currentStyle.textAlign || 'left'}
        onInsertChart={handleAddChart}
        onShare={handleShare}
        onInsertPivot={handleOpenPivotDialog}
        onConditionalFormatting={handleOpenConditionalDialog}
        onShortcuts={() => setIsShortcutsOpen(true)}
        onAdmin={user?.isAdmin ? () => router.push('/admin') : undefined}
        onComments={() => setIsCommentsOpen(true)}
        onAI={() => setIsAIOpen(true)}
        onWorkflow={spreadsheetId ? () => setIsWorkflowOpen(true) : undefined}
      />

      {showFormulaBar && (
        <FormulaBar
          selectedCell={selectedCell}
          value={isEditing ? editValue : String(currentCell?.value ?? '')}
          formula={currentCell?.formula ?? null}
          isEditing={isEditing}
          onValueChange={setEditValue}
          onSubmit={commitEditing}
          onCancel={cancelEditing}
          onEdit={() => selectedCell && startEditing(selectedCell)}
        />
      )}

      <div className={styles.canvasWrapper} style={{ position: 'relative' }}>
        <VersionHistorySidebar
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          onRestore={(index) => alert(`Restore version ${index} logic (requires patching)`)}
        />
        <UserCursors
          users={users}
          getCellPosition={getCellPosition}
          scrollOffset={{ x: 0, y: 0 }}
        />
        <SpreadsheetCanvas
          data={data}
          columns={columns}
          rows={rows}
          config={config}
          selectedCell={selectedCell}
          selection={selection}
          onCellSelect={handleCellSelect}
          onSelectionChange={handleSelectionChange}
          onCellEdit={(pos) => startEditing(pos)}
          conditionalRules={conditionalRules}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          showGridlines={showGridlines}
          onHeaderContextMenu={handleHeaderContextMenu}
          isEditing={isEditing}
        />

        {isEditing && selectedCell && (
          <CellEditor
            key={`${selectedCell.row}-${selectedCell.col}`}
            position={getCellPosition(selectedCell.row, selectedCell.col)}
            value={editValue}
            onChange={setEditValue}
            onCommit={commitEditing}
            onCancel={cancelEditing}
          />
        )}

        {isEditing && selectedCell && (
          <SmartAutocomplete
            visible={true}
            position={getCellPosition(selectedCell.row, selectedCell.col)}
            value={editValue}
            // ...
            onSelect={(val) => {
              setEditValue(val);
              setTimeout(commitEditing, 0);
            }}
            onClose={() => { }}
          />
        )}
        <ChartOverlay
          charts={charts}
          onUpdateChart={handleUpdateChart}
          onRemoveChart={handleRemoveChart}
        />
      </div>

      <ChatPanel
        currentUserId={userId}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
        isOpen={isChatOpen}
        onToggle={toggleChat}
        unreadCount={unreadCount}
      />

      <CommentsPanel
        comments={comments.map(c => ({
          ...c,
          author: {
            id: c.author.id,
            name: c.author.name,
            avatar: c.author.avatar,
          },
          replies: c.replies.map(r => ({
            ...r,
            author: {
              id: r.author.id,
              name: r.author.name,
              avatar: r.author.avatar,
            },
          })),
        }))}
        currentUserId={userId}
        onAddComment={addComment}
        onReply={replyToComment}
        onResolve={resolveComment}
        onDelete={deleteComment}
        selectedCell={selectedCell}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />

      {isAIOpen && (
        <AIAssistant
          onFormulaInsert={(formula) => {
            if (selectedCell) {
              setCellValue(selectedCell.row, selectedCell.col, formula);
            }
            setIsAIOpen(false);
          }}
          selectedRange={selection ? {
            startRow: selection.start.row,
            startCol: selection.start.col,
            endRow: selection.end.row,
            endCol: selection.end.col,
          } : undefined}
          sheetName={sheetTitle}
        />
      )}

      {isChartDialogOpen && (
        <ChartDialog
          isOpen={isChartDialogOpen}
          onClose={() => setIsChartDialogOpen(false)}
          selectedData={selectedData}
          onInsert={handleInsertChart}
        />
      )}

      {isConditionalDialogOpen && selection && (
        <ConditionalFormattingDialog
          isOpen={isConditionalDialogOpen}
          onClose={() => setIsConditionalDialogOpen(false)}
          onSave={handleAddConditionalRule}
          selection={{
            startRow: selection.start.row,
            startCol: selection.start.col,
            endRow: selection.end.row,
            endCol: selection.end.col,
          }}
        />
      )}

      {isPivotDialogOpen && selection && (
        <PivotTableDialog
          isOpen={isPivotDialogOpen}
          onClose={() => setIsPivotDialogOpen(false)}
          onCreate={handleCreatePivot}
          selection={selection}
          data={data}
        />
      )}

      <KeyboardShortcuts
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      <FindDialog
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
        onFind={handleFind}
        onReplace={handleReplace}
        onReplaceAll={replaceAll}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {isShareDialogOpen && spreadsheetId && (
        <ShareDialog
          isOpen={isShareDialogOpen}
          onClose={() => setIsShareDialogOpen(false)}
          spreadsheetId={spreadsheetId}
        />
      )}

      {/* Workflow Manager Side Panel */}
      {isWorkflowOpen && spreadsheetId && (
        <div className={styles.workflowPanel}>
          <div className={styles.workflowPanelHeader}>
            <h3>워크플로우 관리</h3>
            <button
              className={styles.workflowCloseBtn}
              onClick={() => setIsWorkflowOpen(false)}
              title="닫기"
            >
              ✕
            </button>
          </div>
          <div className={styles.workflowPanelContent}>
            <WorkflowManager spreadsheetId={spreadsheetId} />
          </div>
        </div>
      )}

      {contextMenu && (
        <HeaderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          index={contextMenu.index}
          onClose={() => setContextMenu(null)}
          onInsertBefore={contextMenu.type === 'row' ? handleInsertRowBefore : handleInsertColBefore}
          onInsertAfter={contextMenu.type === 'row' ? handleInsertRowAfter : handleInsertColAfter}
          onDelete={contextMenu.type === 'row' ? handleDeleteRow : handleDeleteCol}
          onHide={contextMenu.type === 'row' ? handleHideRow : handleHideCol}
          onUnhide={contextMenu.type === 'row' ? handleUnhideRow : handleUnhideCol}
        />
      )}
    </div>
  );
}
