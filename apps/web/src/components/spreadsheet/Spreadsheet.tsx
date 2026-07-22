"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/hooks/useAuth";
import SpreadsheetCanvas from "./SpreadsheetCanvas";
import CellEditor from "./CellEditor";
import FormulaBar from "./FormulaBar";
import Toolbar from "./Toolbar";
import { UserCursors, ChatPanel, CommentsPanel } from "../collaboration";
import AIAssistant from "./AIAssistant";
import SmartAutocomplete from "./SmartAutocomplete";
import { ChartDialog } from "../charts";
import ChartOverlay from "../charts/ChartOverlay";
import VersionHistorySidebar from "./VersionHistorySidebar";
import ConditionalFormattingDialog, {
  ConditionalRule,
} from "./ConditionalFormattingDialog";
import TableFormatDialog, { TableFormatConfig } from "./TableFormatDialog";
import ThemeDialog, { Theme } from "./ThemeDialog";
import FindDialog from "./FindDialog";
import LinkDialog from "./LinkDialog";

// ... (in Spreadsheet component)

import PivotTableDialog from "./PivotTableDialog";
import { calculatePivotData, PivotConfig } from "@/utils/pivotLogic";
import KeyboardShortcuts from "./KeyboardShortcuts";
import Toast from "../ui/Toast";
import ShareDialog from "./ShareDialog";
import HeaderContextMenu from "./HeaderContextMenu";
import CellContextMenu from "./CellContextMenu";
import {
  CellPosition,
  CellData,
  CellRange,
  SheetData,
  ColumnDef,
  RowDef,
  DEFAULT_CONFIG,
  parseSelection,
  cellRefToString,
} from "@/types/spreadsheet";
import styles from "./Spreadsheet.module.css";
import { useSpreadsheetData } from "@/hooks/spreadsheet/useSpreadsheetData";
import { useSpreadsheetView } from "@/hooks/spreadsheet/useSpreadsheetView";
import { useSpreadsheetSelection } from "@/hooks/spreadsheet/useSpreadsheetSelection";
import { useSpreadsheetEdit } from "@/hooks/spreadsheet/useSpreadsheetEdit";
import { useKeyboardNavigation } from "@/hooks/spreadsheet/useKeyboardNavigation";
import { useSpreadsheetCollaboration } from "@/hooks/spreadsheet/useSpreadsheetCollaboration";
import { useSpreadsheetCharts } from "@/hooks/spreadsheet/useSpreadsheetCharts";
import { useSpreadsheetAutosave } from "@/hooks/spreadsheet/useSpreadsheetAutosave";
import MenuBar from "./MenuBar";
import { createXLSXWorkbook, exportToCSV, type XLSXWorkbookSheet } from "@/utils/export";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { api } from "@/lib/api";
import EmailDialog from "./EmailDialog";
import FileOpenDialog from "./FileOpenDialog";
import { ImportResult } from "@/utils/fileImport";
import { useComments } from "@/hooks/useComments";
import WorkflowManager from "../dashboard/WorkflowManager";

// Advanced Feature Dialogs
import SheetBuilderDialog from "./SheetBuilderDialog";
import ProfilerPanel from "./ProfilerPanel";
import NormalizerDialog from "./NormalizerDialog";
import UDFEditorDialog from "./UDFEditorDialog";
import DocumentationDialog from "./DocumentationDialog";

// New Advanced Features
import SheetPermissionsDialog from "./SheetPermissionsDialog";
import HistoryTimelinePanel from "./HistoryTimelinePanel";
import SheetAutomationDialog from "./SheetAutomationDialog";
import FilterProfilesDropdown, {
  FilterProfile,
} from "./FilterProfilesDropdown";
import {
  getHiddenRowsForFilterView,
  projectFilterViewAxes,
} from "@/utils/filterViews";
import { createFillUpdates } from "@/utils/fillHandle";
import {
  createPasteUpdates,
  createRichPasteUpdates,
  JASHEETS_CLIPBOARD_MIME,
  serializeRangeToRichClipboard,
  serializeRangeToTsv,
} from "@/utils/clipboard";
import SnapshotManagerPanel from "./SnapshotManagerPanel";
import CommandPalette from "./CommandPalette";
import type { PersistedCellUpdate } from "@/utils/cellPersistence";
import SheetTabs, { type SheetTab } from "./SheetTabs";
import type { FormulaWorkbook } from "@/utils/FormulaEngine";
import type { PersistedMergedRange } from "@/lib/api";
import {
  findMergedRange,
  normalizeMergedRange,
  rejectNonAnchorMergedUpdates,
  resolveMergedCell,
  resolveMergedNavigationTarget,
  shiftMergedRanges,
  sortRangeIntersectsMergedRanges,
} from "@/utils/mergedRanges";
import {
  deserializeConditionalRule,
  serializeConditionalRule,
} from "@/utils/conditionalRulePersistence";
import type { ManagedPivotTable, PivotOutputRange } from "@/utils/managedPivots";
import {
  containsPivotOutput,
  getPivotOutputRange,
  parseTargetCell,
  persistThenApplyPivotOutput,
  sourceRangeToA1,
} from "@/utils/managedPivots";

interface SpreadsheetProps {
  currentUser: User;
  initialData?: SheetData;
  initialCharts?: any[];
  initialConditionalRules?: ConditionalRule[];
  initialMergedRanges?: PersistedMergedRange[];
  initialPivotTables?: ManagedPivotTable[];
  onDataChange?: (data: SheetData) => void;
  spreadsheetId?: string;
  activeSheetId?: string | null;
  initialVersion?: number;
  initialRowCount?: number;
  initialColCount?: number;
  initialRows?: RowDef[];
  initialCols?: ColumnDef[];
  initialFrozenRows?: number;
  initialFrozenCols?: number;
  workbook?: FormulaWorkbook;
  currentSheetName?: string;
  title?: string;
  sheets?: SheetTab[];
  onSheetSelect?: (sheetId: string) => Promise<void> | void;
  onSheetAdd?: () => Promise<void> | void;
  onSheetRename?: (sheetId: string, name: string) => Promise<void> | void;
  onSheetDelete?: (sheetId: string) => Promise<void> | void;
  onSheetReorder?: (sheetId: string, index: number) => Promise<void> | void;
  onSheetDuplicate?: (sheetId: string) => Promise<void> | void;
  onVersionChange?: (sheetId: string, version: number) => void;
  onChartsChange?: (sheetId: string, charts: unknown[]) => void;
  onStructureChange?: (
    sheetId: string,
    dimensions: { rowCount: number; colCount: number },
  ) => void;
  onMergedRangesChange?: (
    sheetId: string,
    mergedRanges: PersistedMergedRange[],
  ) => void;
  onPivotTablesChange?: (
    sheetId: string,
    pivotTables: ManagedPivotTable[],
  ) => void;
  onWorkbookImport?: (
    result: ImportResult,
    mode: "append" | "replace",
    activeVersion: number,
  ) => Promise<void>;
  workbookExportSheets?: XLSXWorkbookSheet[];
}

export default function Spreadsheet({
  currentUser,
  initialData = {},
  initialCharts = [],
  initialConditionalRules = [],
  initialMergedRanges = [],
  initialPivotTables = [],
  onDataChange,
  spreadsheetId,
  activeSheetId,
  initialVersion = 0,
  initialRowCount = DEFAULT_CONFIG.totalRows,
  initialColCount = DEFAULT_CONFIG.totalCols,
  initialRows,
  initialCols,
  initialFrozenRows = 0,
  initialFrozenCols = 0,
  workbook,
  currentSheetName,
  title = "Untitled Spreadsheet",
  sheets = [],
  onSheetSelect,
  onSheetAdd,
  onSheetRename,
  onSheetDelete,
  onSheetReorder,
  onSheetDuplicate,
  onVersionChange,
  onChartsChange,
  onStructureChange,
  onMergedRangesChange,
  onPivotTablesChange,
  onWorkbookImport,
  workbookExportSheets = [],
}: SpreadsheetProps) {
  const [sheetTitle, setSheetTitle] = useState(title);
  const [sheetVersion, setSheetVersion] = useState(initialVersion);
  const sheetVersionRef = useRef(initialVersion);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sheetActionPending, setSheetActionPending] = useState(false);
  const user = currentUser;
  const collaborationBroadcastRef = useRef<
    (updates: PersistedCellUpdate[]) => void
  >(() => undefined);
  const viewFlushRef = useRef<() => Promise<void>>(async () => undefined);
  const mergedRangesRef = useRef<PersistedMergedRange[]>(initialMergedRanges);
  const handleAutosaveSaved = useCallback(
    (version: number) => {
      sheetVersionRef.current = version;
      setSheetVersion(version);
      if (activeSheetId) onVersionChange?.(activeSheetId, version);
    },
    [activeSheetId, onVersionChange],
  );
  const handleAutosaveBroadcast = useCallback(
    (updates: PersistedCellUpdate[]) => {
      collaborationBroadcastRef.current(updates);
    },
    [],
  );
  const handleAutosaveError = useCallback(() => {
    setToastMessage(
      "자동 저장에 실패했습니다. 연결이 복구되면 다시 시도합니다.",
    );
  }, []);
  const {
    status: autosaveStatus,
    queueChanges,
    flush: flushAutosave,
  } = useSpreadsheetAutosave({
    sheetId: activeSheetId,
    onSaved: handleAutosaveSaved,
    onBroadcast: handleAutosaveBroadcast,
    onError: handleAutosaveError,
  });

  // Update title if prop changes (e.g. loaded from server)
  useEffect(() => {
    if (title) setSheetTitle(title);
  }, [title]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setSheetTitle(newTitle);
      if (spreadsheetId) {
        try {
          await api.spreadsheets.update(spreadsheetId, { name: newTitle });
        } catch (e) {
          console.error("Failed to update title", e);
          setToastMessage("Failed to save title");
        }
      }
    },
    [spreadsheetId],
  );

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
    sortRows,
    findNext,
    replaceAll,
    updateCellFormat,
    updateCells,
    updateRichCells,
    applyTableFormat,
    sortRange,
    removeDuplicates,
    defineNamedRange,
    updateCellValidation,
    updateCellLink,
    addProtectedRange,
  } = useSpreadsheetData({
    initialData,
    onDataChange,
    onLocalCellsChange: queueChanges,
    currentUserId: user?.id,
    workbook,
    currentSheetName,
  });

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

  const [isPivotDialogOpen, setIsPivotDialogOpen] = useState(false);
  const [pivotTables, setPivotTables] = useState<ManagedPivotTable[]>(() =>
    initialPivotTables.map((pivot) => {
      if (pivot.config.outputRange || !pivot.targetCell) return pivot;
      try {
        const outputRange = getPivotOutputRange(
          pivot.targetCell,
          calculatePivotData(data, pivot.config),
        );
        return outputRange ? { ...pivot, config: { ...pivot.config, outputRange } } : pivot;
      } catch {
        return pivot;
      }
    }),
  );
  const pivotTablesRef = useRef(pivotTables);
  const pivotSourceSignaturesRef = useRef(new Map<string, string>());
  useEffect(() => { pivotTablesRef.current = pivotTables; }, [pivotTables]);
  const isPivotOutputCell = useCallback(
    (position: CellPosition | null) => !!position && pivotTables.some((pivot) =>
      containsPivotOutput(pivot, position.row, position.col)),
    [pivotTables],
  );
  const rangeIntersectsPivotOutput = useCallback((range: CellRange | null) => {
    if (!range) return false;
    const startRow = Math.min(range.start.row, range.end.row);
    const endRow = Math.max(range.start.row, range.end.row);
    const startCol = Math.min(range.start.col, range.end.col);
    const endCol = Math.max(range.start.col, range.end.col);
    return pivotTables.some((pivot) => {
      const output = pivot.config.outputRange;
      return !!output && startRow <= output.endRow && endRow >= output.startRow &&
        startCol <= output.endCol && endCol >= output.startCol;
    });
  }, [pivotTables]);
  const startCellEditing = useCallback((position: CellPosition, value?: string) => {
    if (isPivotOutputCell(position)) {
      setToastMessage("피벗 결과는 직접 수정할 수 없습니다. 피벗 관리에서 편집하거나 삭제해주세요.");
      return;
    }
    startEditing(position, value);
  }, [isPivotOutputCell, startEditing]);

  // --- Clipboard Handling ---
  const copyToClipboard = useCallback(async () => {
    if (!selection) return;

    const text = serializeRangeToTsv(data, selection);
    const rich = serializeRangeToRichClipboard(data, selection);

    try {
      if (rich && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          [JASHEETS_CLIPBOARD_MIME]: new Blob([rich], { type: JASHEETS_CLIPBOARD_MIME }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setToastMessage("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy", err);
      alert("Failed to copy to clipboard");
    }
  }, [data, selection]);

  const cutoffToClipboard = useCallback(async () => {
    if (!selection) return;
    if (rangeIntersectsPivotOutput(selection)) {
      setToastMessage("피벗 결과 범위는 잘라낼 수 없습니다. 피벗 관리에서 삭제해주세요.");
      return;
    }

    // Copy first
    await copyToClipboard();

    // Execute delete
    const updates: { row: number; col: number; value: string }[] = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const anchor = resolveMergedCell(mergedRangesRef.current, r, c).position;
        if (anchor.row !== r || anchor.col !== c) continue;
        updates.push({ row: r, col: c, value: "" });
      }
    }
    updateCells(updates);
  }, [selection, copyToClipboard, rangeIntersectsPivotOutput, updateCells]);

  const pasteFromClipboard = useCallback(async () => {
    if (!selectedCell) return;

    try {
      const origin = resolveMergedCell(
        mergedRangesRef.current,
        selectedCell.row,
        selectedCell.col,
      ).position;
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const richItem = items.find((item) => item.types.includes(JASHEETS_CLIPBOARD_MIME));
        if (richItem) {
          const richText = await (await richItem.getType(JASHEETS_CLIPBOARD_MIME)).text();
          const richUpdates = createRichPasteUpdates(richText, origin);
          const accepted = richUpdates && rejectNonAnchorMergedUpdates(richUpdates, mergedRangesRef.current);
          if (!accepted) setToastMessage("병합된 셀의 일부에는 붙여넣을 수 없습니다.");
          else if (accepted.some(({ row, col }) => isPivotOutputCell({ row, col }))) setToastMessage("피벗 결과 범위에는 붙여넣을 수 없습니다.");
          else if (accepted.length > 0) updateRichCells(accepted.map(({ row, col, cell }) => ({ row, col, cell })));
          if (richUpdates) return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const updates = rejectNonAnchorMergedUpdates(
        createPasteUpdates(text, origin),
        mergedRangesRef.current,
      );

      if (!updates) {
        setToastMessage("병합된 셀의 일부에는 붙여넣을 수 없습니다.");
      } else if (updates.some(({ row, col }) => isPivotOutputCell({ row, col }))) {
        setToastMessage("피벗 결과 범위에는 붙여넣을 수 없습니다.");
      } else if (updates.length > 0) {
        updateCells(updates);
      }
    } catch (err) {
      console.error("Failed to paste", err);
      // Fallback or alert?
      // Often triggered if permission denied or not focused
      alert("Failed to paste from clipboard. Please allow clipboard access.");
    }
  }, [isPivotOutputCell, selectedCell, updateCells, updateRichCells]);

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if (!selection) return;
      e.preventDefault();
      const text = serializeRangeToTsv(data, selection);
      e.clipboardData?.setData("text/plain", text);
      const rich = serializeRangeToRichClipboard(data, selection);
      if (rich) e.clipboardData?.setData(JASHEETS_CLIPBOARD_MIME, rich);
    };

    const handleCut = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if (!selection) return;
      e.preventDefault();
      cutoffToClipboard();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;
      if (!selectedCell) return;
      e.preventDefault();

      // For paste event, we can access data directly which is better than readText() permission-wise within the event
      const origin = resolveMergedCell(
        mergedRangesRef.current,
        selectedCell.row,
        selectedCell.col,
      ).position;
      const rich = e.clipboardData?.getData(JASHEETS_CLIPBOARD_MIME);
      const richUpdates = rich ? createRichPasteUpdates(rich, origin) : null;
      if (richUpdates) {
        const accepted = rejectNonAnchorMergedUpdates(richUpdates, mergedRangesRef.current);
        if (!accepted) setToastMessage("병합된 셀의 일부에는 붙여넣을 수 없습니다.");
        else if (accepted.some(({ row, col }) => isPivotOutputCell({ row, col }))) setToastMessage("피벗 결과 범위에는 붙여넣을 수 없습니다.");
        else if (accepted.length > 0) updateRichCells(accepted.map(({ row, col, cell }) => ({ row, col, cell })));
        return;
      }
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        // Reuse logic? Or just duplicate the parsing for the event version?
        // The event version is synchronous and doesn't need promise.
        // Let's just use the logic inline effectively or refactor parsing.
        // Refactoring parsing to separate function is cleaner but for now let's just duplicate the parsing logic
        // or updates logic.

        const updates = rejectNonAnchorMergedUpdates(
          createPasteUpdates(text, origin),
          mergedRangesRef.current,
        );
        if (!updates) {
          setToastMessage("병합된 셀의 일부에는 붙여넣을 수 없습니다.");
        } else if (updates.some(({ row, col }) => isPivotOutputCell({ row, col }))) {
          setToastMessage("피벗 결과 범위에는 붙여넣을 수 없습니다.");
        } else if (updates.length > 0) {
          updateCells(updates);
        }
      }
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
    };
  }, [
    selection,
    data,
    selectedCell,
    copyToClipboard,
    cutoffToClipboard,
    updateCells,
    updateRichCells,
    isPivotOutputCell,
  ]);

  // Collaboration
  const router = useRouter();
  const [isEmailOpen, setIsEmailOpen] = useState(false);

  const userId = useMemo(() => user?.id || "guest", [user]);
  const userName = useMemo(() => user?.name || user?.email || "Guest", [user]);

  const {
    users,
    chatMessages,
    isChatOpen,
    unreadCount,
    syncStatus,
    toggleChat,
    sendChatMessage,
    sendBatchUpdate,
  } = useSpreadsheetCollaboration({
    userId,
    userName,
    selectedCell,
    selection,
    setData,
    spreadsheetId: spreadsheetId || "demo-sheet",
    activeSheetId,
  });
  useEffect(() => {
    collaborationBroadcastRef.current = (updates) => {
      if (!activeSheetId) return;
      sendBatchUpdate(
        activeSheetId,
        updates.map(({ row, col, value, formula, format }) => ({
          row,
          col,
          value,
          formula: formula ?? undefined,
          format,
        })),
      );
    };
  }, [activeSheetId, sendBatchUpdate]);

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

  useEffect(() => {
    if (activeSheetId) onChartsChange?.(activeSheetId, charts);
  }, [activeSheetId, charts, onChartsChange]);

  // Save handler - defined after charts to access chart state
  const persistActiveSheet = useCallback(async () => {
    if (!activeSheetId) {
      throw new Error("저장할 시트가 없습니다.");
    }
    await flushAutosave();
    await viewFlushRef.current();
    await api.spreadsheets.saveCharts(activeSheetId, charts);
  }, [activeSheetId, charts, flushAutosave]);

  const handleSave = useCallback(async () => {
    try {
      await persistActiveSheet();
      setToastMessage("저장되었습니다.");
    } catch (e) {
      console.error(e);
      setToastMessage(
        e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.",
      );
    }
  }, [persistActiveSheet]);

  const runSheetAction = useCallback(
    async (
      action: () => Promise<void> | void,
      options: { saveFirst?: boolean; successMessage?: string } = {},
    ) => {
      if (sheetActionPending) return;
      setSheetActionPending(true);
      try {
        if (options.saveFirst) await persistActiveSheet();
        await action();
        if (options.successMessage) setToastMessage(options.successMessage);
      } catch (error) {
        console.error("Sheet action failed", error);
        setToastMessage(
          error instanceof Error
            ? error.message
            : "시트 작업을 완료하지 못했습니다.",
        );
      } finally {
        setSheetActionPending(false);
      }
    },
    [persistActiveSheet, sheetActionPending],
  );

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        setIsFileDialogOpen(true);
      }
      // Command Palette shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
  } = useSpreadsheetView({
    initialRows,
    initialCols,
    initialRowCount,
    initialColCount,
    initialFrozenRows,
    initialFrozenCols,
  });
  const viewStateRef = useRef({ rows, columns, config });
  const viewSaveTimerRef = useRef<number | null>(null);
  const viewDirtyRef = useRef(false);
  const [activeFilterView, setActiveFilterView] = useState<{
    sheetId: string;
    profile: FilterProfile;
  } | null>(null);
  const manualSortingsRef = useRef<FilterProfile["sortings"]>([]);

  const filterViewAxes = useMemo(() => {
    if (!activeFilterView || activeFilterView.sheetId !== activeSheetId) {
      return { rows, columns };
    }
    const { profile } = activeFilterView;
    return projectFilterViewAxes(
      rows,
      columns,
      new Set([
        ...getHiddenRowsForFilterView(data, profile.filters),
        ...(profile.hiddenRows ?? []),
      ]),
      new Set(profile.hiddenCols ?? []),
    );
  }, [activeFilterView, activeSheetId, columns, data, rows]);

  useEffect(() => {
    if (
      !selectedCell ||
      (!filterViewAxes.rows[selectedCell.row]?.hidden &&
        !filterViewAxes.columns[selectedCell.col]?.hidden)
    ) {
      return;
    }
    // A filtered-out cell must never leave an editor visually over the next
    // visible cell while commits still target the hidden coordinate.
    cancelEditing();
    setSelectedCell(null);
    setSelection(null);
  }, [cancelEditing, filterViewAxes, selectedCell, setSelectedCell, setSelection]);

  useEffect(() => {
    viewStateRef.current = { rows, columns, config };
  }, [columns, config, rows]);

  const flushViewState = useCallback(async () => {
    if (!activeSheetId || !viewDirtyRef.current) return;
    if (viewSaveTimerRef.current !== null) {
      window.clearTimeout(viewSaveTimerRef.current);
      viewSaveTimerRef.current = null;
    }
    const snapshot = viewStateRef.current;
    viewDirtyRef.current = false;
    try {
      const result = await api.spreadsheets.saveView(activeSheetId, {
        frozenRows: snapshot.config.frozenRows,
        frozenCols: snapshot.config.frozenCols,
        rowMeta: snapshot.rows.flatMap((row, index) =>
          row.hidden || row.height !== snapshot.config.defaultRowHeight
            ? [{ row: index, height: row.height, hidden: Boolean(row.hidden) }]
            : [],
        ),
        colMeta: snapshot.columns.flatMap((column, index) =>
          column.hidden || column.width !== snapshot.config.defaultColWidth
            ? [
                {
                  col: index,
                  width: column.width,
                  hidden: Boolean(column.hidden),
                },
              ]
            : [],
        ),
      });
      sheetVersionRef.current = result.version;
      setSheetVersion(result.version);
      onVersionChange?.(activeSheetId, result.version);
    } catch (error) {
      viewDirtyRef.current = true;
      throw error;
    }
  }, [activeSheetId, onVersionChange]);

  useEffect(() => {
    viewFlushRef.current = flushViewState;
    return () => {
      if (viewSaveTimerRef.current !== null)
        window.clearTimeout(viewSaveTimerRef.current);
      void flushViewState().catch(() => undefined);
    };
  }, [flushViewState]);

  const queueViewSave = useCallback(() => {
    viewDirtyRef.current = true;
    if (viewSaveTimerRef.current !== null)
      window.clearTimeout(viewSaveTimerRef.current);
    viewSaveTimerRef.current = window.setTimeout(() => {
      void flushViewState().catch((error: unknown) => {
        console.error("View autosave failed", error);
        setToastMessage(
          "행·열 보기 설정을 저장하지 못했습니다. 다시 시도합니다.",
        );
      });
    }, 700);
  }, [flushViewState]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "row" | "col";
    index: number;
  } | null>(null);

  const handleHeaderContextMenu = useCallback(
    (x: number, y: number, type: "row" | "col", index: number) => {
      setContextMenu({ x, y, type, index });
    },
    [],
  );

  const runStructuralChange = useCallback(
    async (
      axis: "row" | "column",
      type: "insert" | "delete",
      index: number,
    ) => {
      if (!activeSheetId || sheetActionPending) return;
      setSheetActionPending(true);
      try {
        await persistActiveSheet();
        const result = await api.spreadsheets.changeStructure(activeSheetId, {
          axis,
          type,
          index,
        });
        sheetVersionRef.current = result.version;
        setSheetVersion(result.version);
        onVersionChange?.(activeSheetId, result.version);
        onStructureChange?.(activeSheetId, {
          rowCount: result.rowCount,
          colCount: result.colCount,
        });
        if (Array.isArray(result.pivotTables)) {
          setPivotTables(result.pivotTables);
          pivotTablesRef.current = result.pivotTables;
          onPivotTablesChange?.(activeSheetId, result.pivotTables);
        }
        setConfig((current) => ({
          ...current,
          totalRows: result.rowCount,
          totalCols: result.colCount,
        }));
        setMergedRanges((current) => {
          const shifted = current.flatMap((range) => {
            const next = shiftMergedRanges([range], {
              axis: axis === "column" ? "col" : "row",
              type,
              index,
            })[0];
            return next ? [{ ...range, ...next }] : [];
          });
          onMergedRangesChange?.(activeSheetId, shifted);
          return shifted;
        });

        if (axis === "row") {
          setRows((current) => {
            const next = [...current];
            if (type === "insert") {
              next.splice(index, 0, {
                height: DEFAULT_CONFIG.defaultRowHeight,
              });
            } else {
              next.splice(index, 1);
              next.push({ height: DEFAULT_CONFIG.defaultRowHeight });
            }
            return next;
          });
          if (type === "insert") insertRow(index);
          else deleteRow(index);
        } else {
          setColumns((current) => {
            const next = [...current];
            if (type === "insert") {
              next.splice(index, 0, { width: DEFAULT_CONFIG.defaultColWidth });
            } else {
              next.splice(index, 1);
              next.push({ width: DEFAULT_CONFIG.defaultColWidth });
            }
            return next;
          });
          if (type === "insert") insertColumn(index);
          else deleteColumn(index);
        }
        setToastMessage(
          `${axis === "row" ? "행" : "열"}을 ${type === "insert" ? "삽입" : "삭제"}했습니다.`,
        );
      } catch (error) {
        console.error("Structural change failed", error);
        setToastMessage(
          error instanceof Error
            ? error.message
            : "행·열 변경을 완료하지 못했습니다.",
        );
      } finally {
        setSheetActionPending(false);
      }
    },
    [
      activeSheetId,
      deleteColumn,
      deleteRow,
      insertColumn,
      insertRow,
      onStructureChange,
      onMergedRangesChange,
      onPivotTablesChange,
      onVersionChange,
      persistActiveSheet,
      setColumns,
      setConfig,
      setRows,
      sheetActionPending,
    ],
  );

  const handleInsertRowBefore = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "row") return;
    const index = contextMenu.index;
    setContextMenu(null);
    void runStructuralChange("row", "insert", index);
  }, [contextMenu, runStructuralChange]);

  const handleInsertRowAfter = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "row") return;
    const index = contextMenu.index + 1;
    setContextMenu(null);
    void runStructuralChange("row", "insert", index);
  }, [contextMenu, runStructuralChange]);

  const handleDeleteRow = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "row") return;
    const index = contextMenu.index;
    setContextMenu(null);
    void runStructuralChange("row", "delete", index);
  }, [contextMenu, runStructuralChange]);

  const handleHideRow = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "row") return;
    const index = contextMenu.index;
    setRows((prev) => {
      const newRows = [...prev];
      if (newRows[index]) newRows[index] = { ...newRows[index], hidden: true };
      return newRows;
    });
    queueViewSave();
    setContextMenu(null);
  }, [contextMenu, queueViewSave]);

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
    if (!contextMenu || contextMenu.type !== "row") return;

    // If we have a selection that includes hidden rows, unhide them.
    // Otherwise, check if adjacent rows are hidden?
    // Simple MVP: Unhide ALL hidden rows in the current selection range, or globally if no selection?
    // Let's do: Unhide rows adjacent to current index?
    // Or just unhide the specific index if we could somehow right-click it (not possible if hidden).
    // Standard Excel: Select range covering hidden rows -> Right Click -> Unhide.

    if (
      selection &&
      selection.start.row <= contextMenu.index &&
      selection.end.row >= contextMenu.index
    ) {
      const start = Math.min(selection.start.row, selection.end.row);
      const end = Math.max(selection.end.row, selection.start.row);
      setRows((prev) => {
        const newRows = [...prev];
        for (let i = start; i <= end; i++) {
          if (newRows[i]?.hidden) {
            newRows[i] = { ...newRows[i], hidden: false };
          }
        }
        return newRows;
      });
      queueViewSave();
    }
    setContextMenu(null);
  }, [contextMenu, queueViewSave, selection]);

  const handleInsertColBefore = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "col") return;
    const index = contextMenu.index;
    setContextMenu(null);
    void runStructuralChange("column", "insert", index);
  }, [contextMenu, runStructuralChange]);

  const handleInsertColAfter = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "col") return;
    const index = contextMenu.index + 1;
    setContextMenu(null);
    void runStructuralChange("column", "insert", index);
  }, [contextMenu, runStructuralChange]);

  const handleDeleteCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "col") return;
    const index = contextMenu.index;
    setContextMenu(null);
    void runStructuralChange("column", "delete", index);
  }, [contextMenu, runStructuralChange]);

  const handleHideCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "col") return;
    const index = contextMenu.index;
    setColumns((prev) => {
      const newCols = [...prev];
      if (newCols[index]) newCols[index] = { ...newCols[index], hidden: true };
      return newCols;
    });
    queueViewSave();
    setContextMenu(null);
  }, [contextMenu, queueViewSave]);

  const handleUnhideCol = useCallback(() => {
    if (!contextMenu || contextMenu.type !== "col") return;
    if (
      selection &&
      selection.start.col <= contextMenu.index &&
      selection.end.col >= contextMenu.index
    ) {
      const start = Math.min(selection.start.col, selection.end.col);
      const end = Math.max(selection.end.col, selection.start.col);
      setColumns((prev) => {
        const newCols = [...prev];
        for (let i = start; i <= end; i++) {
          if (newCols[i]?.hidden) {
            newCols[i] = { ...newCols[i], hidden: false };
          }
        }
        return newCols;
      });
      queueViewSave();
    }
    setContextMenu(null);
  }, [contextMenu, queueViewSave, selection]);

  const getCellPosition = useCallback(
    (row: number, col: number) => {
      let x = 50;
      for (let c = 0; c < col; c++)
        x += filterViewAxes.columns[c]?.hidden
          ? 0
          : filterViewAxes.columns[c]?.width || DEFAULT_CONFIG.defaultColWidth;
      let y = 30;
      for (let r = 0; r < row; r++)
        y += filterViewAxes.rows[r]?.hidden
          ? 0
          : filterViewAxes.rows[r]?.height || DEFAULT_CONFIG.defaultRowHeight;
      const width = filterViewAxes.columns[col]?.width || DEFAULT_CONFIG.defaultColWidth;
      const height = filterViewAxes.rows[row]?.height || DEFAULT_CONFIG.defaultRowHeight;
      return { x, y, width, height };
    },
    [filterViewAxes],
  );

  // Wrap selection handlers
  const handleCellSelect = useCallback(
    (pos: CellPosition) => {
      if (!pos) return;

      // Check if we are re-selecting the currently edited cell
      if (
        isEditing &&
        selectedCell &&
        selectedCell.row === pos.row &&
        selectedCell.col === pos.col
      ) {
        return;
      }

      // Auto-commit if moving to another cell while editing
      if (isEditing) {
        commitEditing();
      }

      _handleCellSelect(pos);

      const cell = data[pos.row]?.[pos.col];
      setEditValue(cell?.formula || String(cell?.value ?? ""));
    },
    [
      _handleCellSelect,
      setEditValue,
      data,
      isEditing,
      selectedCell,
      commitEditing,
    ],
  );

  const handleSelectionChange = useCallback(
    (range: CellRange) => {
      _handleSelectionChange(range);
    },
    [_handleSelectionChange],
  );

  // Keyboard Navigation
  useKeyboardNavigation({
    selectedCell,
    selection,
    isEditingRef,
    onCommit: commitEditing,
    onCancel: cancelEditing,
    onStartEdit: (val) => selectedCell && startCellEditing(selectedCell, val),
    onNavigate: (row, col, extend, anchor) => {
      const resolved = selectedCell
        ? resolveMergedNavigationTarget(
            mergedRangesRef.current,
            selectedCell,
            { row, col },
          )
        : resolveMergedCell(mergedRangesRef.current, row, col);
      const target = resolved.position;
      handleCellSelect(target);
      setSelection(
        extend
          ? parseSelection(anchor, target)
          : resolved.range
            ? {
                start: {
                  row: resolved.range.startRow,
                  col: resolved.range.startCol,
                },
                end: {
                  row: resolved.range.endRow,
                  col: resolved.range.endCol,
                },
              }
            : { start: target, end: target },
      );
    },
    onClearSelection: () => {
      if (!selection) return;
      if (rangeIntersectsPivotOutput(selection)) {
        setToastMessage("피벗 결과 범위는 직접 지울 수 없습니다. 피벗 관리에서 삭제해주세요.");
        return;
      }
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
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>(
    initialConditionalRules,
  );
  const [mergedRanges, setMergedRanges] = useState<PersistedMergedRange[]>(
    initialMergedRanges,
  );
  useEffect(() => {
    mergedRangesRef.current = mergedRanges;
  }, [mergedRanges]);
  const trySortRows = useCallback((colIndex: number, ascending: boolean): boolean => {
    const populatedRows = Object.keys(data).map(Number).filter(Number.isFinite);
    if (populatedRows.length > 0 && sortRangeIntersectsMergedRanges({
      start: { row: Math.min(...populatedRows), col: 0 },
      end: { row: Math.max(...populatedRows), col: Number.MAX_SAFE_INTEGER },
    }, mergedRanges)) {
      setToastMessage("병합된 셀이 포함된 범위는 정렬할 수 없습니다. 먼저 병합을 해제해주세요.");
      return false;
    }
    sortRows(colIndex, ascending);
    return true;
  }, [data, mergedRanges, sortRows]);
  const [isConditionalDialogOpen, setIsConditionalDialogOpen] = useState(false);

  // Table Format Dialog state
  const [isTableFormatOpen, setIsTableFormatOpen] = useState(false);

  // Theme Dialog state
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);

  // Cell Context Menu state
  const [cellContextMenu, setCellContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Keyboard Shortcuts state
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

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

  // Advanced Feature Dialog states
  const [isSheetBuilderOpen, setIsSheetBuilderOpen] = useState(false);
  const [isProfilerOpen, setIsProfilerOpen] = useState(false);
  const [isNormalizerOpen, setIsNormalizerOpen] = useState(false);
  const [isUDFEditorOpen, setIsUDFEditorOpen] = useState(false);
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);

  // New Advanced Feature states
  const [isSheetPermissionsOpen, setIsSheetPermissionsOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [isAutomationDialogOpen, setIsAutomationDialogOpen] = useState(false);
  const [isSnapshotPanelOpen, setIsSnapshotPanelOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Handler for applying theme to selected range
  const handleApplyTheme = useCallback(
    (theme: Theme) => {
      if (!selection) {
        alert("테마를 적용할 셀 범위를 먼저 선택해주세요.");
        return;
      }

      const updates: { row: number; col: number; value: string }[] = [];
      const startRow = Math.min(selection.start.row, selection.end.row);
      const endRow = Math.max(selection.start.row, selection.end.row);
      const startCol = Math.min(selection.start.col, selection.end.col);
      const endCol = Math.max(selection.start.col, selection.end.col);

      // Apply styles to header row (first row of selection)
      for (let c = startCol; c <= endCol; c++) {
        updateCellStyle(
          { start: { row: startRow, col: c }, end: { row: startRow, col: c } },
          {
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
            fontWeight: "bold",
          },
        );
      }

      // Apply alternating row colors to remaining rows
      for (let r = startRow + 1; r <= endRow; r++) {
        const isEvenRow = (r - startRow) % 2 === 0;
        const bgColor = isEvenRow
          ? theme.colors.evenRowBg
          : theme.colors.oddRowBg;

        for (let c = startCol; c <= endCol; c++) {
          updateCellStyle(
            { start: { row: r, col: c }, end: { row: r, col: c } },
            {
              backgroundColor: bgColor,
              color: "#202124",
            },
          );
        }
      }

      setToastMessage(`'${theme.name}' 테마가 적용되었습니다.`);
    },
    [selection, updateCellStyle],
  );

  // Handler for clearing all freeze (rows and columns)
  const handleUnfreeze = useCallback(() => {
    setConfig((prev) => ({ ...prev, frozenRows: 0, frozenCols: 0 }));
    queueViewSave();
    setToastMessage("모든 고정이 해제되었습니다.");
  }, [queueViewSave, setConfig]);

  // Handler for zoom change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    // Apply zoom via CSS transform would require more changes to the grid
    document.documentElement.style.setProperty(
      "--spreadsheet-zoom",
      `${newZoom / 100}`,
    );
    setToastMessage(`확대/축소: ${newZoom}%`);
  }, []);

  // Handler for trim whitespace on selected cells
  const handleTrimWhitespace = useCallback(() => {
    if (!selection) {
      alert("공백을 제거할 범위를 선택해주세요.");
      return;
    }
    if (rangeIntersectsPivotOutput(selection)) {
      setToastMessage("피벗 결과 범위는 직접 수정할 수 없습니다.");
      return;
    }
    const updates: { row: number; col: number; value: string }[] = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const val = data[r]?.[c]?.value;
        if (typeof val === "string") {
          updates.push({ row: r, col: c, value: val.trim() });
        }
      }
    }
    if (updates.length > 0) {
      updateCells(updates);
      setToastMessage("공백이 제거되었습니다.");
    }
  }, [selection, data, rangeIntersectsPivotOutput, updateCells]);

  const handleSortRangeAsc = useCallback(() => {
    if (!selection) {
      alert("정렬할 범위를 선택해주세요.");
      return;
    }
    let sortCol = selection.start.col;
    if (
      selectedCell &&
      selectedCell.col >= Math.min(selection.start.col, selection.end.col) &&
      selectedCell.col <= Math.max(selection.start.col, selection.end.col)
    ) {
      sortCol = selectedCell.col;
    }
    if (sortRangeIntersectsMergedRanges(selection, mergedRanges)) {
      setToastMessage("병합된 셀이 포함된 범위는 정렬할 수 없습니다. 먼저 병합을 해제해주세요.");
      return;
    }
    if (rangeIntersectsPivotOutput(selection)) {
      setToastMessage("피벗 결과가 포함된 범위는 정렬할 수 없습니다.");
      return;
    }
    sortRange(selection, sortCol, true);
    setToastMessage("범위 정렬 완료 (오름차순)");
  }, [mergedRanges, rangeIntersectsPivotOutput, selection, selectedCell, sortRange]);

  const handleSortRangeDesc = useCallback(() => {
    if (!selection) {
      alert("정렬할 범위를 선택해주세요.");
      return;
    }
    let sortCol = selection.start.col;
    if (
      selectedCell &&
      selectedCell.col >= Math.min(selection.start.col, selection.end.col) &&
      selectedCell.col <= Math.max(selection.start.col, selection.end.col)
    ) {
      sortCol = selectedCell.col;
    }
    if (sortRangeIntersectsMergedRanges(selection, mergedRanges)) {
      setToastMessage("병합된 셀이 포함된 범위는 정렬할 수 없습니다. 먼저 병합을 해제해주세요.");
      return;
    }
    if (rangeIntersectsPivotOutput(selection)) {
      setToastMessage("피벗 결과가 포함된 범위는 정렬할 수 없습니다.");
      return;
    }
    sortRange(selection, sortCol, false);
    setToastMessage("범위 정렬 완료 (내림차순)");
  }, [mergedRanges, rangeIntersectsPivotOutput, selection, selectedCell, sortRange]);

  const handleRemoveDuplicates = useCallback(() => {
    if (!selection) {
      alert("중복을 제거할 범위를 선택해주세요.");
      return;
    }
    if (rangeIntersectsPivotOutput(selection)) {
      setToastMessage("피벗 결과가 포함된 범위에서는 중복을 제거할 수 없습니다.");
      return;
    }
    removeDuplicates(selection);
    setToastMessage("중복 항목이 제거되었습니다.");
  }, [rangeIntersectsPivotOutput, selection, removeDuplicates]);

  const handleSplitTextToColumns = useCallback(() => {
    if (!selection) {
      alert("텍스트를 나눌 범위를 선택해주세요.");
      return;
    }
    const updates: { row: number; col: number; value: string }[] = [];
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const col = Math.min(selection.start.col, selection.end.col);

    for (let r = startRow; r <= endRow; r++) {
      const val = data[r]?.[col]?.value;
      if (typeof val === "string") {
        const parts = val.split(",");
        parts.forEach((part, idx) => {
          updates.push({ row: r, col: col + idx, value: part.trim() });
        });
      }
    }
    if (updates.length > 0) {
      if (updates.some(({ row, col }) => isPivotOutputCell({ row, col }))) {
        setToastMessage("피벗 결과 범위에는 텍스트를 나눌 수 없습니다.");
        return;
      }
      updateCells(updates);
      setToastMessage("텍스트 나누기 완료 (쉼표 기준)");
    }
  }, [selection, data, isPivotOutputCell, updateCells]);

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
        setToastMessage("Link copied to clipboard (Unsaved sheet)");
      } catch (err) {
        setToastMessage("Failed to copy link");
      }
    }
  }, [spreadsheetId]);

  // Handle file import
  const handleFileImport = useCallback(
    async (result: ImportResult, mode: "append" | "replace") => {
      if (spreadsheetId && onWorkbookImport) {
        await persistActiveSheet();
        await onWorkbookImport(result, mode, sheetVersionRef.current);
        setToastMessage(`${result.sheetNames.length}개 시트를 가져왔습니다.`);
        return;
      }
      setData(result.data);
      if (result.sheetName && !spreadsheetId) {
        setSheetTitle(result.sheetName);
      }
      setToastMessage(`"${result.sheetName}" 파일을 불러왔습니다.`);
    },
    [onWorkbookImport, persistActiveSheet, spreadsheetId],
  );

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
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        setIsShortcutsOpen((prev) => !prev);
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.shiftKey ? handleRedo() : handleUndo();
            e.preventDefault();
            break;
          case "y":
            handleRedo();
            e.preventDefault();
            break;
          case "b":
            updateCellStyle(selection, {
              fontWeight:
                currentStyle.fontWeight === "bold" ? "normal" : "bold",
            });
            e.preventDefault();
            break;
          case "i":
            updateCellStyle(selection, {
              fontStyle:
                currentStyle.fontStyle === "italic" ? "normal" : "italic",
            });
            e.preventDefault();
            break;
          case "u":
            updateCellStyle(selection, {
              textDecoration:
                currentStyle.textDecoration === "underline"
                  ? "none"
                  : "underline",
            });
            e.preventDefault();
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, updateCellStyle, currentStyle, selection]);

  const selectedData = useMemo(() => {
    if (!selection) return [];
    const result = [];
    for (let r = selection.start.row; r <= selection.end.row; r++) {
      const rowData = [];
      for (let c = selection.start.col; c <= selection.end.col; c++) {
        const cell = data[r]?.[c];
        rowData.push(cell?.value ?? "");
      }
      result.push(rowData);
    }
    return result;
  }, [data, selection]);

  // Find Handlers
  const handleFind = useCallback(
    (query: string, matchCase: boolean) => {
      const start = selectedCell || { row: -1, col: -1 };
      const next = findNext(query, matchCase, start);
      if (next) {
        _handleCellSelect(next);
      } else {
        const nextWrap = findNext(query, matchCase, { row: -1, col: -1 });
        if (nextWrap) {
          _handleCellSelect(nextWrap);
        } else {
          alert("검색 결과가 없습니다.");
        }
      }
    },
    [findNext, selectedCell, _handleCellSelect],
  );

  const handleReplace = useCallback(
    (query: string, replacement: string, matchCase: boolean) => {
      if (!selectedCell) {
        handleFind(query, matchCase);
        return;
      }

      const val = String(currentCell?.value ?? "");
      const target = matchCase ? query : query.toLowerCase();
      const source = matchCase ? val : val.toLowerCase();

      if (source.includes(target)) {
        if (isPivotOutputCell(selectedCell)) {
          setToastMessage("피벗 결과는 직접 바꿀 수 없습니다.");
          return;
        }
        if (matchCase) {
          setCellValue(
            selectedCell.row,
            selectedCell.col,
            val.replace(query, replacement),
          );
        } else {
          const re = new RegExp(
            query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
          );
          // Replace only first?
          setCellValue(
            selectedCell.row,
            selectedCell.col,
            val.replace(re, replacement),
          );
        }
        handleFind(query, matchCase);
      } else {
        handleFind(query, matchCase);
      }
    },
    [selectedCell, currentCell, handleFind, isPivotOutputCell, setCellValue],
  );

  // Feature Handlers
  const handleAddConditionalRule = useCallback(
    async (rule: ConditionalRule) => {
      if (!activeSheetId) {
        setConditionalRules((prev) => [...prev, rule]);
        return;
      }
      try {
        const saved = await api.conditionalRules.create(
          activeSheetId,
          serializeConditionalRule(rule),
        );
        const persisted = deserializeConditionalRule(saved);
        if (persisted) setConditionalRules((prev) => [...prev, persisted]);
      } catch (error) {
        console.error("Failed to save conditional rule", error);
        setToastMessage("조건부 서식을 저장하지 못했습니다.");
      }
    },
    [activeSheetId],
  );

  const handleOpenConditionalDialog = useCallback(() => {
    if (selection) {
      setIsConditionalDialogOpen(true);
    } else {
      alert("먼저 범위를 선택해주세요.");
    }
  }, [selection]);

  const handleOpenPivotDialog = useCallback(() => {
    if (!selection && pivotTables.length === 0) {
      setToastMessage("새 피벗을 만들려면 데이터 범위를 먼저 선택해주세요.");
      return;
    }
    setIsPivotDialogOpen(true);
  }, [pivotTables.length, selection]);

  const pivotOutputUpdates = useCallback((
    previousRange: PivotOutputRange | undefined,
    targetCell: string,
    output: SheetData,
  ) => {
    const updates: Array<{ row: number; col: number; cell: CellData }> = [];
    if (previousRange) for (let row = previousRange.startRow; row <= previousRange.endRow; row++) {
      for (let col = previousRange.startCol; col <= previousRange.endCol; col++) {
        updates.push({ row, col, cell: { value: null } });
      }
    }
    const target = parseTargetCell(targetCell);
    if (target) for (const [rowKey, cells] of Object.entries(output)) {
      for (const [colKey, cell] of Object.entries(cells) as Array<[string, CellData]>) {
        updates.push({ row: target.row + Number(rowKey), col: target.col + Number(colKey), cell });
      }
    }
    return updates;
  }, []);

  const persistPivotDefinitions = useCallback(async (definitions: ManagedPivotTable[]) => {
    if (!activeSheetId) throw new Error("활성 시트가 없습니다.");
    // Source edits and pivot metadata share the sheet version CAS. Drain the
    // cell queue first so both writes cannot race using the same version.
    await flushAutosave();
    const saved = await api.spreadsheets.savePivotTables(
      activeSheetId,
      definitions,
      sheetVersionRef.current,
    );
    setPivotTables(saved.pivotTables);
    pivotTablesRef.current = saved.pivotTables;
    sheetVersionRef.current = saved.version;
    setSheetVersion(saved.version);
    onVersionChange?.(activeSheetId, saved.version);
    onPivotTablesChange?.(activeSheetId, saved.pivotTables);
    return saved.pivotTables;
  }, [activeSheetId, flushAutosave, onPivotTablesChange, onVersionChange]);

  const handleSavePivot = useCallback(async ({ id, name, targetCell, config }: {
    id?: string; name: string; targetCell: string; config: PivotConfig;
  }) => {
    try {
      const output = calculatePivotData(data, config);
      const outputRange = getPivotOutputRange(targetCell, output);
      if (!outputRange) throw new Error("피벗 결과가 비어 있습니다.");
      const overlaps = (a: PivotOutputRange, b: PivotOutputRange) =>
        a.startRow <= b.endRow && a.endRow >= b.startRow && a.startCol <= b.endCol && a.endCol >= b.startCol;
      if (overlaps(outputRange, config.sourceRange)) throw new Error("출력 범위가 원본 범위와 겹칩니다.");
      const previous = pivotTables.find((pivot) => pivot.id === id);
      if (pivotTables.some((pivot) => pivot.id !== id && pivot.config.outputRange && overlaps(outputRange, pivot.config.outputRange))) {
        throw new Error("출력 범위가 다른 피벗 테이블과 겹칩니다.");
      }
      const previousOutput = previous?.config.outputRange;
      const wouldOverwrite = Object.keys(output).some((key) => {
        const [rowOffset, colOffset] = key.split(":").map(Number);
        const row = outputRange.startRow + rowOffset;
        const col = outputRange.startCol + colOffset;
        const belongsToPrevious = previousOutput && row >= previousOutput.startRow && row <= previousOutput.endRow &&
          col >= previousOutput.startCol && col <= previousOutput.endCol;
        const cell = data[row]?.[col];
        return !belongsToPrevious && (cell?.value != null || !!cell?.formula);
      });
      if (wouldOverwrite && !confirm("피벗 출력 범위에 기존 데이터가 있습니다. 덮어쓸까요?")) return;
      const definition: ManagedPivotTable = {
        ...(id ? { id } : {}), name, targetCell,
        sourceRange: sourceRangeToA1(config),
        config: { ...config, outputRange },
      };
      const next = id
        ? pivotTables.map((pivot) => pivot.id === id ? definition : pivot)
        : [...pivotTables, definition];
      if (id) {
        const values = [];
        for (let row = config.sourceRange.startRow; row <= config.sourceRange.endRow; row++) {
          for (let col = config.sourceRange.startCol; col <= config.sourceRange.endCol; col++) {
            const cell = data[row]?.[col];
            values.push([cell?.value ?? null, cell?.formula ?? null]);
          }
        }
        pivotSourceSignaturesRef.current.set(id, JSON.stringify(values));
      }
      await persistThenApplyPivotOutput(
        () => persistPivotDefinitions(next),
        () => updateRichCells(pivotOutputUpdates(previous?.config.outputRange, targetCell, output)),
      );
      setIsPivotDialogOpen(false);
      setToastMessage(id ? "피벗 테이블을 변경했습니다." : "피벗 테이블을 생성했습니다.");
    } catch (error) {
      console.error("Failed to save pivot", error);
      setToastMessage(error instanceof Error ? error.message : "피벗 테이블을 저장하지 못했습니다.");
    }
  }, [data, persistPivotDefinitions, pivotOutputUpdates, pivotTables, updateRichCells]);

  const handleDeletePivot = useCallback(async (pivot: ManagedPivotTable) => {
    if (!confirm(`'${pivot.name || "피벗 테이블"}'을 삭제할까요?`)) return;
    try {
      await persistThenApplyPivotOutput(
        () => persistPivotDefinitions(pivotTables.filter((candidate) => candidate.id !== pivot.id)),
        () => {
          if (pivot.config.outputRange) updateRichCells(pivotOutputUpdates(pivot.config.outputRange, "", {}));
        },
      );
      setToastMessage("피벗 테이블을 삭제했습니다.");
    } catch (error) {
      console.error("Failed to delete pivot", error);
      setToastMessage("피벗 테이블을 삭제하지 못했습니다.");
    }
  }, [persistPivotDefinitions, pivotOutputUpdates, pivotTables, updateRichCells]);

  useEffect(() => {
    if (!activeSheetId || pivotTables.length === 0) return;
    const signatureFor = (pivot: ManagedPivotTable) => {
      const range = pivot.config.sourceRange;
      const values = [];
      for (let row = range.startRow; row <= range.endRow; row++) {
        for (let col = range.startCol; col <= range.endCol; col++) {
          const cell = data[row]?.[col];
          values.push([cell?.value ?? null, cell?.formula ?? null]);
        }
      }
      return JSON.stringify(values);
    };
    const changed = pivotTables.filter((pivot, index) => {
      const key = pivot.id ?? `pending-${index}`;
      const signature = signatureFor(pivot);
      const previous = pivotSourceSignaturesRef.current.get(key);
      if (previous === undefined) pivotSourceSignaturesRef.current.set(key, signature);
      return previous !== undefined && previous !== signature;
    });
    if (changed.length === 0) return;
    const timer = window.setTimeout(() => {
      const current = pivotTablesRef.current;
      const updates: Array<{ row: number; col: number; cell: CellData }> = [];
      let next = current;
      try {
        next = current.map((pivot) => {
          if (!changed.some(({ id }) => id === pivot.id)) return pivot;
          const output = calculatePivotData(data, pivot.config);
          if (!pivot.targetCell) return pivot;
          const targetCell = pivot.targetCell;
          const outputRange = getPivotOutputRange(targetCell, output);
          updates.push(...pivotOutputUpdates(pivot.config.outputRange, targetCell, output));
          return { ...pivot, config: { ...pivot.config, outputRange: outputRange ?? undefined } };
        });
        void persistThenApplyPivotOutput(
          () => persistPivotDefinitions(next),
          () => { if (updates.length > 0) updateRichCells(updates); },
        ).then(() => {
          changed.forEach((pivot, index) => {
            pivotSourceSignaturesRef.current.set(pivot.id ?? `pending-${index}`, signatureFor(pivot));
          });
        }).catch((error) => {
          console.error("Failed to recalculate pivots", error);
          setToastMessage("피벗 자동 재계산을 저장하지 못했습니다.");
        });
      } catch (error) {
        console.error("Failed to recalculate pivots", error);
        setToastMessage("피벗 자동 재계산에 실패했습니다.");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeSheetId, data, persistPivotDefinitions, pivotOutputUpdates, pivotTables, updateRichCells]);

  const handleMergeCells = useCallback(async () => {
    if (!activeSheetId || !selection) {
      setToastMessage("병합할 범위를 먼저 선택해주세요.");
      return;
    }
    const range = normalizeMergedRange({
      startRow: selection.start.row,
      endRow: selection.end.row,
      startCol: selection.start.col,
      endCol: selection.end.col,
    });
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      setToastMessage("두 개 이상의 셀을 선택해주세요.");
      return;
    }
    const hiddenValues = Object.keys(data).some((rowKey) => {
      const row = Number(rowKey);
      if (row < range.startRow || row > range.endRow) return false;
      return Object.keys(data[row] ?? {}).some((colKey) => {
        const col = Number(colKey);
        if (row === range.startRow && col === range.startCol) return false;
        return col >= range.startCol && col <= range.endCol &&
          data[row]?.[col]?.value !== null && data[row]?.[col]?.value !== "";
      });
    });
    if (hiddenValues && !window.confirm(
      "병합하면 왼쪽 위 셀을 제외한 값이 삭제됩니다. 계속하시겠습니까?",
    )) return;

    if (sheetActionPending) return;
    setSheetActionPending(true);
    try {
      await persistActiveSheet();
      const result = await api.spreadsheets.mergeCells(
        activeSheetId,
        range,
        sheetVersionRef.current,
      );
      setMergedRanges((current) => {
        const next = [...current, result.mergedRange];
        onMergedRangesChange?.(activeSheetId, next);
        return next;
      });
      sheetVersionRef.current = result.version;
      setSheetVersion(result.version);
      onVersionChange?.(activeSheetId, result.version);
      const next = { ...data };
        for (let row = range.startRow; row <= range.endRow; row++) {
          if (!next[row]) continue;
          next[row] = { ...next[row] };
          for (let col = range.startCol; col <= range.endCol; col++) {
            if (row !== range.startRow || col !== range.startCol) delete next[row][col];
          }
        }
      updateData(next);
      setToastMessage("셀을 병합했습니다.");
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "셀 병합에 실패했습니다.");
    } finally {
      setSheetActionPending(false);
    }
  }, [activeSheetId, data, onMergedRangesChange, onVersionChange, persistActiveSheet, selection, sheetActionPending, updateData]);

  const handleUnmergeCells = useCallback(async () => {
    if (!activeSheetId || !selectedCell) return;
    const range = findMergedRange(mergedRanges, selectedCell.row, selectedCell.col) as
      | PersistedMergedRange
      | undefined;
    if (!range) {
      setToastMessage("선택한 셀은 병합되어 있지 않습니다.");
      return;
    }
    if (sheetActionPending) return;
    setSheetActionPending(true);
    try {
      await persistActiveSheet();
      const result = await api.spreadsheets.unmergeCells(
        activeSheetId,
        range,
        sheetVersionRef.current,
      );
      setMergedRanges((current) => {
        const next = current.filter(({ id }) => id !== range.id);
        onMergedRangesChange?.(activeSheetId, next);
        return next;
      });
      sheetVersionRef.current = result.version;
      setSheetVersion(result.version);
      onVersionChange?.(activeSheetId, result.version);
      setToastMessage("셀 병합을 해제했습니다.");
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "병합 해제에 실패했습니다.");
    } finally {
      setSheetActionPending(false);
    }
  }, [activeSheetId, mergedRanges, onMergedRangesChange, onVersionChange, persistActiveSheet, selectedCell, sheetActionPending]);

  return (
    <div className={styles.container}>
      <MenuBar
        onExportCSV={() =>
          exportToCSV(data, `${sheetTitle.trim() || "spreadsheet"}.csv`)
        }
        onDownloadXLSX={() => {
          const exportSheets = workbookExportSheets.length > 0
            ? workbookExportSheets.map((sheet) => sheet.name === currentSheetName ? {
                ...sheet,
                data,
                mergedRanges,
                rows: Object.fromEntries(rows.map((row, index) => [index, row])),
                columns: Object.fromEntries(columns.map((column, index) => [index, column])),
              } : sheet)
            : [{
                name: currentSheetName || "Sheet1",
                data,
                mergedRanges,
                rows: Object.fromEntries(rows.map((row, index) => [index, row])),
                columns: Object.fromEntries(columns.map((column, index) => [index, column])),
              }];
          const wb = createXLSXWorkbook(exportSheets);
          XLSX.writeFile(wb, `${sheetTitle.trim() || "spreadsheet"}.xlsx`);
        }}
        onDownloadPDF={() => {
          const doc = new jsPDF();
          const rows = Object.keys(data)
            .map(Number)
            .sort((a, b) => a - b);
          const maxRow = rows.length ? rows[rows.length - 1] : 0;
          const maxCol = 10;
          const body = [];
          for (let r = 0; r <= maxRow; r++) {
            const rowData = [];
            for (let c = 0; c < maxCol; c++) {
              rowData.push(String(data[r]?.[c]?.value ?? ""));
            }
            body.push(rowData);
          }
          autoTable(doc, {
            head: [],
            body: body,
          });
          doc.save(`${sheetTitle.trim() || "spreadsheet"}.pdf`);
        }}
        onMakeCopy={async () => {
          if (!spreadsheetId) {
            alert("저장된 시트만 복사할 수 있습니다.");
            return;
          }
          try {
            const newSheet = await api.spreadsheets.copy(spreadsheetId);
            if (
              confirm("복사가 완료되었습니다. 복사된 시트로 이동하시겠습니까?")
            ) {
              router.push(`/spreadsheet/${newSheet.id}`);
            }
          } catch (e) {
            alert("오류가 발생했습니다.");
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
        onInsertRow={() => {
          if (selectedCell)
            void runStructuralChange("row", "insert", selectedCell.row);
        }}
        onInsertCol={() => {
          if (selectedCell)
            void runStructuralChange("column", "insert", selectedCell.col);
        }}
        onDeleteRow={() => {
          if (selectedCell)
            void runStructuralChange("row", "delete", selectedCell.row);
        }}
        onDeleteCol={() => {
          if (selectedCell)
            void runStructuralChange("column", "delete", selectedCell.col);
        }}
        onFreezeRow={() => {
          if (selectedCell) {
            handleFreezeRow(selectedCell.row);
            queueViewSave();
          } else {
            alert("고정할 행 아래의 셀을 선택해주세요.");
          }
        }}
        onFreezeCol={() => {
          if (selectedCell) {
            handleFreezeCol(selectedCell.col);
            queueViewSave();
          } else {
            alert("고정할 열 오른쪽의 셀을 선택해주세요.");
          }
        }}
        onFilter={() => {
          if (!selectedCell) {
            if (rows.some((r) => r?.hidden)) {
              setRows((prev) => prev.map((r) => ({ ...r, hidden: false })));
              alert("필터가 해제되었습니다.");
            } else {
              alert("필터를 적용할 셀을 선택해주세요.");
            }
            return;
          }
          const targetValue = data[selectedCell.row]?.[selectedCell.col]?.value;
          const targetCol = selectedCell.col;
          setRows((prev) =>
            prev.map((r, i) => {
              const cellValue = data[i]?.[targetCol]?.value;
              if (cellValue !== targetValue) {
                return { ...r, hidden: true };
              }
              return { ...r, hidden: false };
            }),
          );
        }}
        onSortAsc={() => {
          if (selectedCell) {
            if (trySortRows(selectedCell.col, true)) {
              manualSortingsRef.current = [{
                column: selectedCell.col,
                direction: "asc",
              }];
            }
          } else {
            alert("정렬할 열의 셀을 선택해주세요.");
          }
        }}
        onSortDesc={() => {
          if (selectedCell) {
            if (trySortRows(selectedCell.col, false)) {
              manualSortingsRef.current = [{
                column: selectedCell.col,
                direction: "desc",
              }];
            }
          } else {
            alert("정렬할 열의 셀을 선택해주세요.");
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
        onInsertLink={() => {
          if (selectedCell) setIsLinkDialogOpen(true);
          else alert("링크를 삽입할 셀을 선택해주세요.");
        }}
        onMergeCells={() => void handleMergeCells()}
        onUnmergeCells={() => void handleUnmergeCells()}
        onUnfreeze={handleUnfreeze}
        onZoomChange={handleZoomChange}
        onTrimWhitespace={handleTrimWhitespace}
        onFormatNumber={(fmt) => updateCellFormat(selection, fmt)}
        onTableFormat={() => setIsTableFormatOpen(true)}
        onTheme={() => setIsThemeDialogOpen(true)}
        onSortRangeAsc={handleSortRangeAsc}
        onSortRangeDesc={handleSortRangeDesc}
        onRemoveDuplicates={handleRemoveDuplicates}
        onSplitTextToColumns={handleSplitTextToColumns}
        onDataValidation={() => {
          if (!selection) {
            alert("유효성 검사를 설정할 범위를 먼저 선택해주세요.");
            return;
          }
          const values = prompt(
            "허용할 값을 쉼표로 구분해 입력하세요. (예: 대기,진행,완료)",
          );
          if (values === null) return;
          const allowedValues = values
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
          if (allowedValues.length === 0) {
            alert("하나 이상의 허용 값을 입력해주세요.");
            return;
          }
          updateCellValidation(selection, {
            type: "list",
            values: allowedValues,
          });
          setToastMessage("데이터 유효성 검사 규칙이 적용되었습니다.");
        }}
        onNamedRanges={() => {
          if (!selection) {
            alert("이름을 지정할 범위를 먼저 선택해주세요.");
            return;
          }
          const name = prompt("선택한 범위의 이름을 입력하세요.");
          if (!name) return;
          try {
            defineNamedRange(name, selection);
            setToastMessage(
              `이름 범위 ${name.trim().toUpperCase()}가 등록되었습니다.`,
            );
          } catch (error) {
            alert(
              error instanceof Error
                ? error.message
                : "이름 범위를 등록하지 못했습니다.",
            );
          }
        }}
        onProtectedRanges={() => {
          if (!selection) {
            alert("보호할 범위를 먼저 선택해주세요.");
            return;
          }
          try {
            addProtectedRange(selection);
            setToastMessage("선택 범위가 보호되었습니다.");
          } catch (error) {
            alert(
              error instanceof Error
                ? error.message
                : "범위를 보호하지 못했습니다.",
            );
          }
        }}
        showFormulaBar={showFormulaBar}
        showGridlines={showGridlines}
        zoom={zoom}
        // Advanced Tools Menu
        onSheetBuilder={() => setIsSheetBuilderOpen(true)}
        onProfiler={() => setIsProfilerOpen(true)}
        onNormalizer={() => setIsNormalizerOpen(true)}
        onUDFEditor={() => setIsUDFEditorOpen(true)}
        onDocumentation={() => setIsDocumentationOpen(true)}
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
          alert(
            `이메일을 보냈습니다! (시뮬레이션)\nTo: ${email}\nSubject: ${subject}\nMsg: ${message}`,
          );
          setIsEmailOpen(false);
        }}
      />
      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBold={() =>
          updateCellStyle(selection, {
            fontWeight: currentStyle.fontWeight === "bold" ? "normal" : "bold",
          })
        }
        onItalic={() =>
          updateCellStyle(selection, {
            fontStyle:
              currentStyle.fontStyle === "italic" ? "normal" : "italic",
          })
        }
        onUnderline={() =>
          updateCellStyle(selection, {
            textDecoration:
              currentStyle.textDecoration === "underline"
                ? "none"
                : "underline",
          })
        }
        onAlignLeft={() => updateCellStyle(selection, { textAlign: "left" })}
        onAlignCenter={() =>
          updateCellStyle(selection, { textAlign: "center" })
        }
        onAlignRight={() => updateCellStyle(selection, { textAlign: "right" })}
        onFormat={(fmt) => updateCellFormat(selection, fmt)}
        canUndo={canUndo}
        canRedo={canRedo}
        isBold={currentStyle.fontWeight === "bold"}
        isItalic={currentStyle.fontStyle === "italic"}
        isUnderline={currentStyle.textDecoration === "underline"}
        alignment={currentStyle.textAlign || "left"}
        onInsertChart={handleAddChart}
        onShare={handleShare}
        onInsertPivot={handleOpenPivotDialog}
        onConditionalFormatting={handleOpenConditionalDialog}
        onShortcuts={() => setIsShortcutsOpen(true)}
        onAdmin={user?.isAdmin ? () => router.push("/admin") : undefined}
        onComments={() => setIsCommentsOpen(true)}
        onAI={() => setIsAIOpen(true)}
        onWorkflow={spreadsheetId ? () => setIsWorkflowOpen(true) : undefined}
      />

      {showFormulaBar && (
        <FormulaBar
          selectedCell={selectedCell}
          value={isEditing ? editValue : String(currentCell?.value ?? "")}
          formula={currentCell?.formula ?? null}
          isEditing={isEditing}
          onValueChange={setEditValue}
          onSubmit={commitEditing}
          onCancel={cancelEditing}
          onEdit={() => selectedCell && startCellEditing(selectedCell)}
        />
      )}

      {activeSheetId && (
        <FilterProfilesDropdown
          sheetId={activeSheetId}
          onApplyProfile={(profile: FilterProfile) => {
            setActiveFilterView({ sheetId: activeSheetId, profile });
            if (profile.sortings?.length) {
              setToastMessage("개인 필터 보기 정렬은 원본 데이터를 보호하기 위해 적용하지 않았습니다.");
            }
          }}
          getProfileSnapshot={() => ({
            hiddenRows: rows.flatMap((row, index) => row.hidden ? [index] : []),
            hiddenCols: columns.flatMap((column, index) => column.hidden ? [index] : []),
            sortings: activeFilterView?.sheetId === activeSheetId
              ? activeFilterView.profile.sortings ?? []
              : manualSortingsRef.current,
          })}
          onClearFilters={() => {
            setActiveFilterView(null);
          }}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "2px 8px",
          fontSize: "12px",
          color:
            autosaveStatus === "error" || syncStatus !== "connected"
              ? "#b06000"
              : "#188038",
        }}
      >
        동기화:{" "}
        {syncStatus === "connected"
          ? "연결됨"
          : syncStatus === "reconnecting"
            ? "재연결 중"
            : syncStatus === "connecting"
              ? "연결 중"
              : "연결 끊김"}
        {" · "}저장:{" "}
        {autosaveStatus === "saved"
          ? "완료"
          : autosaveStatus === "saving"
            ? "저장 중"
            : autosaveStatus === "unsaved"
              ? "변경 대기"
              : "재시도 필요"}
        {" · "}버전 {sheetVersion}
      </div>

      <div className={styles.canvasWrapper} style={{ position: "relative" }}>
        <VersionHistorySidebar
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          spreadsheetId={spreadsheetId}
          onRestore={() => window.location.reload()}
        />
        <UserCursors
          users={users}
          getCellPosition={getCellPosition}
          scrollOffset={{ x: 0, y: 0 }}
        />
        <SpreadsheetCanvas
          data={data}
          columns={filterViewAxes.columns}
          rows={filterViewAxes.rows}
          config={config}
          selectedCell={selectedCell}
          selection={selection}
          onCellSelect={handleCellSelect}
          onSelectionChange={handleSelectionChange}
          onCellEdit={(pos) => startCellEditing(pos)}
          conditionalRules={conditionalRules}
          mergedRanges={mergedRanges}
          onColumnResize={(index, width) => {
            handleColumnResize(index, width);
            queueViewSave();
          }}
          onRowResize={(index, height) => {
            handleRowResize(index, height);
            queueViewSave();
          }}
          showGridlines={showGridlines}
          onHeaderContextMenu={handleHeaderContextMenu}
          onCellContextMenu={(x, y) => setCellContextMenu({ x, y })}
          isEditing={isEditing}
          onFillRange={(source, target) => {
            if (rangeIntersectsPivotOutput(target)) {
              setToastMessage("피벗 결과 범위에는 자동 채우기를 적용할 수 없습니다.");
              return;
            }
            const updates = rejectNonAnchorMergedUpdates(
              createFillUpdates(data, source, target),
              mergedRanges,
            );
            if (!updates) {
              setToastMessage("병합된 셀의 일부에는 자동 채우기를 적용할 수 없습니다.");
              return;
            }
            updateCells(updates);
          }}
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
            onClose={() => {}}
          />
        )}
        <ChartOverlay
          charts={charts}
          onUpdateChart={handleUpdateChart}
          onRemoveChart={handleRemoveChart}
        />
      </div>

      {sheets.length > 0 &&
        onSheetSelect &&
        onSheetAdd &&
        onSheetRename &&
        onSheetDelete &&
        onSheetReorder &&
        onSheetDuplicate && (
          <SheetTabs
            sheets={sheets}
            activeSheetId={activeSheetId ?? null}
            disabled={sheetActionPending}
            onSelect={(sheetId) => {
              if (sheetId === activeSheetId) return;
              return runSheetAction(() => onSheetSelect(sheetId), {
                saveFirst: true,
              });
            }}
            onAdd={() =>
              runSheetAction(onSheetAdd, {
                saveFirst: true,
                successMessage: "새 시트를 추가했습니다.",
              })
            }
            onRename={(sheetId, name) =>
              runSheetAction(() => onSheetRename(sheetId, name), {
                successMessage: "시트 이름을 변경했습니다.",
              })
            }
            onDelete={(sheetId) => {
              const sheet = sheets.find(({ id }) => id === sheetId);
              if (
                !confirm(
                  `'${sheet?.name ?? "시트"}' 시트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
                )
              )
                return;
              return runSheetAction(() => onSheetDelete(sheetId), {
                saveFirst: true,
                successMessage: "시트를 삭제했습니다.",
              });
            }}
            onReorder={(sheetId, index) =>
              runSheetAction(() => onSheetReorder(sheetId, index), {
                saveFirst: true,
                successMessage: "시트 순서를 변경했습니다.",
              })
            }
            onDuplicate={(sheetId) =>
              runSheetAction(() => onSheetDuplicate(sheetId), {
                saveFirst: true,
                successMessage: "시트를 복제했습니다.",
              })
            }
          />
        )}

      <ChatPanel
        currentUserId={userId}
        messages={chatMessages}
        onSendMessage={sendChatMessage}
        isOpen={isChatOpen}
        onToggle={toggleChat}
        unreadCount={unreadCount}
      />

      <CommentsPanel
        comments={comments.map((c) => ({
          ...c,
          author: {
            id: c.author.id,
            name: c.author.name,
            avatar: c.author.avatar,
          },
          replies: c.replies.map((r) => ({
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
              if (isPivotOutputCell(selectedCell)) {
                setToastMessage("피벗 결과는 직접 수정할 수 없습니다.");
              } else {
                setCellValue(selectedCell.row, selectedCell.col, formula);
              }
            }
            setIsAIOpen(false);
          }}
          selectedRange={
            selection
              ? {
                  startRow: selection.start.row,
                  startCol: selection.start.col,
                  endRow: selection.end.row,
                  endCol: selection.end.col,
                }
              : undefined
          }
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
          onSave={(rule) => void handleAddConditionalRule(rule)}
          selection={{
            startRow: selection.start.row,
            startCol: selection.start.col,
            endRow: selection.end.row,
            endCol: selection.end.col,
          }}
        />
      )}

      {isPivotDialogOpen && (
        <PivotTableDialog
          isOpen={isPivotDialogOpen}
          onClose={() => setIsPivotDialogOpen(false)}
          onSave={(definition) => void handleSavePivot(definition)}
          onDelete={(pivot) => void handleDeletePivot(pivot)}
          selection={selection}
          data={data}
          pivotTables={pivotTables}
        />
      )}

      {isTableFormatOpen && (
        <TableFormatDialog
          isOpen={isTableFormatOpen}
          onClose={() => setIsTableFormatOpen(false)}
          onApply={(config: TableFormatConfig) => {
            if (selection) {
              applyTableFormat(selection, {
                headerBg: config.preset.headerBg,
                headerColor: config.preset.headerColor,
                headerBold: config.preset.headerBold,
                oddRowBg: config.customOddColor || config.preset.oddRowBg,
                evenRowBg: config.customEvenColor || config.preset.evenRowBg,
                textColor: config.preset.textColor,
                hasHeader: config.hasHeader,
                alternatingColors: config.alternatingColors,
              });
              setToastMessage("테이블 서식이 적용되었습니다.");
            }
          }}
          selection={selection}
        />
      )}

      {isThemeDialogOpen && (
        <ThemeDialog
          isOpen={isThemeDialogOpen}
          onClose={() => setIsThemeDialogOpen(false)}
          onApply={handleApplyTheme}
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

      {isLinkDialogOpen && selectedCell && (
        <LinkDialog
          initialText={String(data[selectedCell.row]?.[selectedCell.col]?.value ?? "")}
          initialUrl={data[selectedCell.row]?.[selectedCell.col]?.link?.url ?? ""}
          onApply={({ text, url }) => {
            updateCellLink(selectedCell, text, url);
            setIsLinkDialogOpen(false);
          }}
          onClose={() => setIsLinkDialogOpen(false)}
        />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
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

      {cellContextMenu && (
        <CellContextMenu
          x={cellContextMenu.x}
          y={cellContextMenu.y}
          onClose={() => setCellContextMenu(null)}
          onCut={cutoffToClipboard}
          onCopy={copyToClipboard}
          onPaste={pasteFromClipboard}
          onInsertRowAbove={() => {
            if (selectedCell) insertRow(selectedCell.row);
          }}
          onInsertRowBelow={() => {
            if (selectedCell) insertRow(selectedCell.row + 1);
          }}
          onInsertColLeft={() => {
            if (selectedCell) insertColumn(selectedCell.col);
          }}
          onInsertColRight={() => {
            if (selectedCell) insertColumn(selectedCell.col + 1);
          }}
          onDeleteRow={() => {
            if (selectedCell) deleteRow(selectedCell.row);
          }}
          onDeleteCol={() => {
            if (selectedCell) deleteColumn(selectedCell.col);
          }}
          onTableFormat={() => setIsTableFormatOpen(true)}
          onConditionalFormat={() =>
            alert(
              "조건부 서식 기능은 메뉴 > 서식 > 조건부 서식에서 사용하세요.",
            )
          }
          hasSelection={
            selection !== null &&
            (selection.start.row !== selection.end.row ||
              selection.start.col !== selection.end.col)
          }
        />
      )}

      {contextMenu && (
        <HeaderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          index={contextMenu.index}
          onClose={() => setContextMenu(null)}
          onInsertBefore={
            contextMenu.type === "row"
              ? handleInsertRowBefore
              : handleInsertColBefore
          }
          onInsertAfter={
            contextMenu.type === "row"
              ? handleInsertRowAfter
              : handleInsertColAfter
          }
          onDelete={
            contextMenu.type === "row" ? handleDeleteRow : handleDeleteCol
          }
          onHide={contextMenu.type === "row" ? handleHideRow : handleHideCol}
          onUnhide={
            contextMenu.type === "row" ? handleUnhideRow : handleUnhideCol
          }
        />
      )}

      {/* Advanced Feature Dialogs */}
      <SheetBuilderDialog
        isOpen={isSheetBuilderOpen}
        onClose={() => setIsSheetBuilderOpen(false)}
        onApply={(result) => {
          if (result.cells) {
            const newData = { ...data };
            result.cells.forEach((row, rIdx) => {
              if (!newData[rIdx]) newData[rIdx] = {};
              row.forEach((cell, cIdx) => {
                newData[rIdx][cIdx] = { value: cell };
              });
            });
            updateData(newData);
            setToastMessage("AI 시트가 생성되었습니다.");
          }
        }}
      />

      {isProfilerOpen && (
        <div className={styles.profilerSidePanel}>
          <ProfilerPanel
            isOpen={isProfilerOpen}
            onClose={() => setIsProfilerOpen(false)}
            data={selectedData}
            sheetName={sheetTitle}
          />
        </div>
      )}

      <NormalizerDialog
        isOpen={isNormalizerOpen}
        onClose={() => setIsNormalizerOpen(false)}
        onApply={(normalizedData) => {
          if (!selection) return;
          const startRow = Math.min(selection.start.row, selection.end.row);
          const startCol = Math.min(selection.start.col, selection.end.col);
          const newData = { ...data };
          normalizedData.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
              const r = startRow + rIdx;
              const c = startCol + cIdx;
              if (!newData[r]) newData[r] = {};
              newData[r][c] = { ...newData[r]?.[c], value: val };
            });
          });
          updateData(newData);
          setToastMessage("데이터가 정규화되었습니다.");
        }}
        data={selectedData}
      />

      <UDFEditorDialog
        isOpen={isUDFEditorOpen}
        onClose={() => setIsUDFEditorOpen(false)}
        onSave={(udf) => {
          setToastMessage(`함수 ${udf.name}이(가) 저장되었습니다.`);
        }}
        spreadsheetId={spreadsheetId || "demo"}
      />

      <DocumentationDialog
        isOpen={isDocumentationOpen}
        onClose={() => setIsDocumentationOpen(false)}
        data={selectedData}
        sheetName={sheetTitle}
      />

      {/* New Advanced Feature Components */}
      <SheetPermissionsDialog
        isOpen={isSheetPermissionsOpen}
        onClose={() => setIsSheetPermissionsOpen(false)}
        sheetId={activeSheetId || ""}
        sheetName={sheetTitle}
      />

      <HistoryTimelinePanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        sheetId={activeSheetId || ""}
        onRollback={() => {
          setToastMessage("시트가 이전 버전으로 복원되었습니다.");
          // Reload data after rollback
        }}
      />

      <SheetAutomationDialog
        isOpen={isAutomationDialogOpen}
        onClose={() => setIsAutomationDialogOpen(false)}
        sheetId={activeSheetId || ""}
      />

      <SnapshotManagerPanel
        isOpen={isSnapshotPanelOpen}
        onClose={() => setIsSnapshotPanelOpen(false)}
        sheetId={activeSheetId || ""}
        onRestore={() => {
          setToastMessage("스냅샷이 복원되었습니다.");
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        spreadsheetId={spreadsheetId || ""}
        sheetId={activeSheetId || ""}
        onExecute={(commandName, result) => {
          setToastMessage(`명령어 '${commandName}' 실행 완료`);
          if (result?.cellUpdates) {
            // Handle cell updates if any
          }
        }}
      />
    </div>
  );
}
