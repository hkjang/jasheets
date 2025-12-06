'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SpreadsheetCanvas from './SpreadsheetCanvas';
import CellEditor from './CellEditor';
import FormulaBar from './FormulaBar';
import Toolbar from './Toolbar';
import { UserCursors, ChatPanel } from '../collaboration';
import SmartAutocomplete from './SmartAutocomplete';
import { ChartDialog } from '../charts';
import ChartOverlay from '../charts/ChartOverlay';
import ConditionalFormattingDialog, { ConditionalRule } from './ConditionalFormattingDialog';
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
import { useSpreadsheetSelection } from '@/hooks/spreadsheet/useSpreadsheetSelection';
import { useSpreadsheetEdit } from '@/hooks/spreadsheet/useSpreadsheetEdit';
import { useKeyboardNavigation } from '@/hooks/spreadsheet/useKeyboardNavigation';
import { useSpreadsheetCollaboration } from '@/hooks/spreadsheet/useSpreadsheetCollaboration';
import { useSpreadsheetCharts } from '@/hooks/spreadsheet/useSpreadsheetCharts';

interface SpreadsheetProps {
  initialData?: SheetData;
  onDataChange?: (data: SheetData) => void;
  spreadsheetId?: string;
}

export default function Spreadsheet({ initialData = {}, onDataChange, spreadsheetId }: SpreadsheetProps) {
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

  // Collaboration
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);
  
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
  });

  // Charts
  const {
    charts,
    isChartDialogOpen,
    setIsChartDialogOpen,
    handleAddChart,
    handleInsertChart,
    handleUpdateChart,
    handleRemoveChart,
  } = useSpreadsheetCharts();

  // Columns & Rows
  const [columns, setColumns] = useState<ColumnDef[]>(() =>
    Array(DEFAULT_CONFIG.totalCols).fill(null).map(() => ({ width: DEFAULT_CONFIG.defaultColWidth }))
  );
  const [rows, setRows] = useState<RowDef[]>(() =>
    Array(DEFAULT_CONFIG.totalRows).fill(null).map(() => ({ height: DEFAULT_CONFIG.defaultRowHeight }))
  );

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
    _handleCellSelect(pos);
    setEditing(false);
    const cell = data[pos.row]?.[pos.col];
    setEditValue(cell?.formula || String(cell?.value ?? ''));
  }, [_handleCellSelect, setEditing, setEditValue, data]);

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
      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBold={() => updateCellStyle(selection, { fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
        onItalic={() => updateCellStyle(selection, { fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
        onUnderline={() => updateCellStyle(selection, { textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline' })}
        onAlignLeft={() => updateCellStyle(selection, { textAlign: 'left' })}
        onAlignCenter={() => updateCellStyle(selection, { textAlign: 'center' })}
        onAlignRight={() => updateCellStyle(selection, { textAlign: 'right' })}
        onFormat={(fmt) => console.log('Format:', fmt)}
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
      />

      <FormulaBar
        selectedCell={selectedCell}
        value={String(currentCell?.value ?? '')}
        formula={currentCell?.formula ?? null}
        isEditing={isEditing}
        onValueChange={setEditValue}
        onSubmit={commitEditing}
        onCancel={cancelEditing}
        onEdit={() => selectedCell && startEditing(selectedCell)}
      />
      
      <div className={styles.canvasWrapper} style={{ position: 'relative' }}>
        <UserCursors 
          users={users} 
          getCellPosition={getCellPosition} 
          scrollOffset={{ x: 0, y: 0 }} 
        />
        <SpreadsheetCanvas
          data={data}
          columns={columns}
          rows={rows}
          selectedCell={selectedCell}
          selection={selection}
          onCellSelect={handleCellSelect}
          onSelectionChange={handleSelectionChange}
          onCellEdit={(pos) => startEditing(pos)}
          conditionalRules={conditionalRules} 
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onHeaderContextMenu={handleHeaderContextMenu}
        />
        
        {isEditing && selectedCell && (
             <CellEditor
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
            onSelect={(val) => {
              setEditValue(val);
              setTimeout(commitEditing, 0);
            }}
            onClose={() => {}}
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
