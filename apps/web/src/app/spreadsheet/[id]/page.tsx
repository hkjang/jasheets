"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearAuthSession } from "@/lib/auth-session";
import Spreadsheet, {
  type WorkbookSearchSession,
} from "@/components/spreadsheet/Spreadsheet";
import { api, type SpreadsheetSheet } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";
import {
  SpreadsheetErrorState,
  SpreadsheetLoadingState,
} from "@/components/ui/PageLoadState";
import {
  DEFAULT_CONFIG,
  type CellPosition,
  type CellData,
  type ColumnDef,
  type RowData,
  type RowDef,
  type SheetData,
} from "@/types/spreadsheet";
import { deserializeCellFormat } from "@/utils/cellPersistence";
import { rewriteSheetNameReferences } from "@/utils/formulaReferences";
import { deserializeConditionalRule } from "@/utils/conditionalRulePersistence";
import {
  createWorkbookImportSheets,
  type ImportResult,
} from "@/utils/fileImport";
import type { XLSXWorkbookSheet } from "@/utils/export";
import type { ManagedPivotTable } from "@/utils/managedPivots";

function deserializeSheetData(sheet: SpreadsheetSheet): SheetData {
  const sheetData: SheetData = {};
  sheet.cells?.forEach((cell) => {
    if (!sheetData[cell.row]) sheetData[cell.row] = {};
    sheetData[cell.row][cell.col] = {
      value: cell.value,
      formula: cell.formula ?? undefined,
      ...deserializeCellFormat(cell.format),
    };
  });
  return sheetData;
}

function rewriteWorkbookSheetReferences(
  workbookData: Record<string, SheetData>,
  sheetName: string,
  replacement?: string,
): Record<string, SheetData> {
  return Object.fromEntries(
    Object.entries(workbookData).map(([sheetId, data]) => [
      sheetId,
      Object.fromEntries(
        (Object.entries(data) as [string, RowData][]).map(([row, rowData]) => [
          row,
          Object.fromEntries(
            (Object.entries(rowData) as [string, CellData][]).map(
              ([col, cell]) => {
                if (!cell.formula) return [col, cell];
                const formula = rewriteSheetNameReferences(
                  cell.formula,
                  sheetName,
                  replacement,
                );
                if (formula === cell.formula) return [col, cell];
                return [
                  col,
                  {
                    ...cell,
                    formula,
                    ...(replacement === undefined
                      ? {
                          value: "#REF!" as const,
                          displayValue: "#REF!",
                          error: "#REF!",
                        }
                      : {}),
                  },
                ];
              },
            ),
          ),
        ]),
      ),
    ]),
  );
}

export default function SpreadsheetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<SheetData>({});
  const [initialCharts, setInitialCharts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [activeSheetVersion, setActiveSheetVersion] = useState(0);
  const [canvasTransition, setCanvasTransition] = useState<{
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [sheetData, setSheetData] = useState<Record<string, SheetData>>({});
  const [pendingSelectedCell, setPendingSelectedCell] =
    useState<CellPosition | null>(null);
  const [pendingToastMessage, setPendingToastMessage] = useState<string | null>(
    null,
  );
  const [workbookSearchSession, setWorkbookSearchSession] =
    useState<WorkbookSearchSession | null>(null);

  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Auth check
  const { user, loading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const loadSpreadsheet = useCallback(
    async (background = false, preferredSheetId?: string | null) => {
      if (!id) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      if (!background) setLoading(true);
      setError(null);

      try {
        const res = await api.spreadsheets.get(id, controller.signal);
        if (requestId !== requestRef.current) return;
        setTitle(res.name || "Untitled Spreadsheet");
        const sheets = res.sheets || [];
        setSheets(sheets);
        setSheetData(
          Object.fromEntries(
            sheets.map((sheet) => [sheet.id, deserializeSheetData(sheet)]),
          ),
        );
        if (sheets.length > 0) {
          const selectedSheet =
            sheets.find(({ id: sheetId }) => sheetId === preferredSheetId) ??
            sheets[0];
          setActiveSheetId(selectedSheet.id);
          setActiveSheetVersion(selectedSheet.version ?? 0);
          setData(deserializeSheetData(selectedSheet));

          if (selectedSheet.charts && Array.isArray(selectedSheet.charts)) {
            setInitialCharts(selectedSheet.charts);
          } else {
            setInitialCharts([]);
          }
        } else {
          setData({});
          setActiveSheetId(null);
          setInitialCharts([]);
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        )
          return;
        console.error("Failed to load spreadsheet:", err);
        if (err instanceof ApiError && err.status === 401) {
          clearAuthSession();
          router.replace("/login");
        } else if (err instanceof ApiError && err.status === 403) {
          setError(
            "이 문서를 열 권한이 없습니다. 소유자에게 접근 권한을 요청해 주세요.",
          );
        } else if (err instanceof ApiError && err.status === 404) {
          setError("문서가 삭제되었거나 주소가 올바르지 않습니다.");
        } else if (err instanceof DOMException && err.name === "TimeoutError") {
          setError(
            "서버 응답이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
          );
        } else {
          setError("문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        if (requestId === requestRef.current && !controller.signal.aborted)
          setLoading(false);
      }
    },
    [id, router],
  );

  const selectSheet = useCallback(
    (sheetId: string, targetCell?: CellPosition, notification?: string) => {
      const sheet = sheets.find(
        ({ id: candidateId }) => candidateId === sheetId,
      );
      if (!sheet) return;
      setPendingSelectedCell(targetCell ?? null);
      setPendingToastMessage(notification ?? null);
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[role="grid"]',
      );
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        try {
          setCanvasTransition({
            url: canvas.toDataURL(),
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
        } catch {
          setCanvasTransition(null);
        }
      }
      setActiveSheetId(sheet.id);
      setActiveSheetVersion(sheet.version ?? 0);
      setData(sheetData[sheet.id] ?? deserializeSheetData(sheet));
      setInitialCharts(Array.isArray(sheet.charts) ? sheet.charts : []);
    },
    [sheetData, sheets],
  );

  useEffect(() => {
    if (!canvasTransition) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setCanvasTransition(null));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [activeSheetId, canvasTransition]);

  const addSheet = useCallback(async () => {
    const existingNames = new Set(
      sheets.map(({ name }) => name.toLocaleLowerCase()),
    );
    let suffix = sheets.length + 1;
    while (existingNames.has(`sheet ${suffix}`.toLocaleLowerCase()))
      suffix += 1;
    const created = await api.spreadsheets.addSheet(id, `Sheet ${suffix}`);
    const newSheet = { ...created, cells: [], charts: [] };
    setSheets((current) => [...current, newSheet]);
    setSheetData((current) => ({ ...current, [newSheet.id]: {} }));
    setActiveSheetId(newSheet.id);
    setActiveSheetVersion(newSheet.version ?? 0);
    setData({});
    setInitialCharts([]);
  }, [id, sheets]);

  const renameSheet = useCallback(
    async (sheetId: string, name: string) => {
      const previousName = sheets.find(
        ({ id: candidateId }) => candidateId === sheetId,
      )?.name;
      const updated = await api.spreadsheets.renameSheet(sheetId, name);
      if (previousName) {
        setSheetData((current) =>
          rewriteWorkbookSheetReferences(current, previousName, updated.name),
        );
      }
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, name: updated.name } : sheet,
        ),
      );
    },
    [sheets],
  );

  const deleteSheet = useCallback(
    async (sheetId: string) => {
      const deletedIndex = sheets.findIndex(
        ({ id: candidateId }) => candidateId === sheetId,
      );
      if (deletedIndex < 0 || sheets.length <= 1) return;
      const deletedName = sheets[deletedIndex].name;
      await api.spreadsheets.deleteSheet(sheetId);
      const remaining = sheets.filter(
        ({ id: candidateId }) => candidateId !== sheetId,
      );
      const nextSheet = remaining[Math.min(deletedIndex, remaining.length - 1)];
      setSheets(remaining);
      setSheetData((current) => {
        const next = rewriteWorkbookSheetReferences(current, deletedName);
        delete next[sheetId];
        return next;
      });
      setActiveSheetId(nextSheet.id);
      setActiveSheetVersion(nextSheet.version ?? 0);
      setData(sheetData[nextSheet.id] ?? deserializeSheetData(nextSheet));
      setInitialCharts(Array.isArray(nextSheet.charts) ? nextSheet.charts : []);
    },
    [sheetData, sheets],
  );

  const reorderSheet = useCallback(
    async (sheetId: string, targetIndex: number) => {
      await api.spreadsheets.reorderSheet(sheetId, targetIndex);
      setSheets((current) => {
        const sourceIndex = current.findIndex(
          ({ id: candidateId }) => candidateId === sheetId,
        );
        if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length)
          return current;
        const reordered = [...current];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);
        return reordered.map((sheet, index) => ({ ...sheet, index }));
      });
    },
    [],
  );

  const duplicateSheet = useCallback(async (sheetId: string) => {
    const created = await api.spreadsheets.duplicateSheet(sheetId);
    const duplicatedData = deserializeSheetData(created);
    setSheets((current) => [...current, created]);
    setSheetData((current) => ({ ...current, [created.id]: duplicatedData }));
    setActiveSheetId(created.id);
    setActiveSheetVersion(created.version ?? 0);
    setData(duplicatedData);
    setInitialCharts(Array.isArray(created.charts) ? created.charts : []);
  }, []);

  const handleDataChange = useCallback(
    (nextData: SheetData) => {
      if (!activeSheetId) return;
      setData(nextData);
      setSheetData((current) => ({ ...current, [activeSheetId]: nextData }));
    },
    [activeSheetId],
  );

  const handleVersionChange = useCallback(
    (sheetId: string, version: number) => {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, version } : sheet,
        ),
      );
    },
    [],
  );

  const handleChartsChange = useCallback(
    (sheetId: string, charts: unknown[]) => {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, charts } : sheet,
        ),
      );
    },
    [],
  );

  const handleStructureChange = useCallback(
    (sheetId: string, dimensions: { rowCount: number; colCount: number }) => {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, ...dimensions } : sheet,
        ),
      );
    },
    [],
  );

  const handleMergedRangesChange = useCallback(
    (sheetId: string, mergedRanges: SpreadsheetSheet["mergedRanges"]) => {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, mergedRanges } : sheet,
        ),
      );
    },
    [],
  );

  const handlePivotTablesChange = useCallback(
    (sheetId: string, pivotTables: ManagedPivotTable[]) => {
      setSheets((current) =>
        current.map((sheet) =>
          sheet.id === sheetId ? { ...sheet, pivotTables } : sheet,
        ),
      );
    },
    [],
  );

  const importWorkbook = useCallback(
    async (
      result: ImportResult,
      mode: "append" | "replace",
      activeVersion: number,
    ) => {
      await api.spreadsheets.importWorkbook(id, {
        mode,
        sheets: createWorkbookImportSheets(result),
        expectedSheetVersions: sheets.map((sheet) => ({
          sheetId: sheet.id,
          version:
            sheet.id === activeSheetId ? activeVersion : (sheet.version ?? 0),
        })),
      });
      await loadSpreadsheet(true, activeSheetId);
    },
    [activeSheetId, id, loadSpreadsheet, sheets],
  );

  const activeSheet = useMemo(
    () => sheets.find(({ id: sheetId }) => sheetId === activeSheetId),
    [activeSheetId, sheets],
  );
  const initialRows = useMemo<RowDef[] | undefined>(() => {
    if (!activeSheet) return undefined;
    const nextRows: RowDef[] = Array.from(
      { length: activeSheet.rowCount ?? DEFAULT_CONFIG.totalRows },
      () => ({
        height: activeSheet.defaultRowHeight ?? DEFAULT_CONFIG.defaultRowHeight,
      }),
    );
    activeSheet.rowMeta?.forEach((meta) => {
      if (!nextRows[meta.row]) return;
      nextRows[meta.row] = {
        height:
          meta.height ??
          activeSheet.defaultRowHeight ??
          DEFAULT_CONFIG.defaultRowHeight,
        hidden: meta.hidden,
      };
    });
    return nextRows;
  }, [activeSheet]);
  const initialCols = useMemo<ColumnDef[] | undefined>(() => {
    if (!activeSheet) return undefined;
    const nextCols: ColumnDef[] = Array.from(
      { length: activeSheet.colCount ?? DEFAULT_CONFIG.totalCols },
      () => ({
        width: activeSheet.defaultColWidth ?? DEFAULT_CONFIG.defaultColWidth,
      }),
    );
    activeSheet.colMeta?.forEach((meta) => {
      if (!nextCols[meta.col]) return;
      nextCols[meta.col] = {
        width:
          meta.width ??
          activeSheet.defaultColWidth ??
          DEFAULT_CONFIG.defaultColWidth,
        hidden: meta.hidden,
      };
    });
    return nextCols;
  }, [activeSheet]);
  const workbook = useMemo(
    () =>
      Object.fromEntries(
        sheets.map((sheet) => [
          sheet.name,
          sheetData[sheet.id] ?? deserializeSheetData(sheet),
        ]),
      ),
    [sheetData, sheets],
  );
  const workbookExportSheets = useMemo<XLSXWorkbookSheet[]>(
    () =>
      sheets.map((sheet) => ({
        name: sheet.name,
        data: sheetData[sheet.id] ?? deserializeSheetData(sheet),
        mergedRanges: sheet.mergedRanges ?? [],
        rows: Object.fromEntries(
          (sheet.rowMeta ?? []).map((row) => [
            row.row,
            {
              height:
                row.height ??
                sheet.defaultRowHeight ??
                DEFAULT_CONFIG.defaultRowHeight,
              hidden: row.hidden,
            },
          ]),
        ),
        columns: Object.fromEntries(
          (sheet.colMeta ?? []).map((column) => [
            column.col,
            {
              width:
                column.width ??
                sheet.defaultColWidth ??
                DEFAULT_CONFIG.defaultColWidth,
              hidden: column.hidden,
            },
          ]),
        ),
      })),
    [sheetData, sheets],
  );
  const initialConditionalRules = useMemo(
    () =>
      (activeSheet?.conditionalRules ?? [])
        .map(deserializeConditionalRule)
        .filter((rule) => rule !== null),
    [activeSheet],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    void loadSpreadsheet();
    return () => abortRef.current?.abort();
  }, [authLoading, user, loadSpreadsheet]);

  // Show loading while checking auth
  if (authLoading) {
    return <SpreadsheetLoadingState />;
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return <SpreadsheetLoadingState />;
  }

  if (loading) return <SpreadsheetLoadingState />;
  if (error)
    return (
      <SpreadsheetErrorState
        title="스프레드시트를 열 수 없습니다"
        message={error}
        onRetry={() => void loadSpreadsheet()}
        onBack={() => router.push("/dashboard")}
      />
    );

  return (
    <>
      <Spreadsheet
        key={activeSheetId}
        currentUser={user}
        initialData={data}
        initialCharts={initialCharts}
        initialConditionalRules={initialConditionalRules}
        initialMergedRanges={activeSheet?.mergedRanges ?? []}
        initialPivotTables={activeSheet?.pivotTables ?? []}
        onDataChange={handleDataChange}
        spreadsheetId={id}
        activeSheetId={activeSheetId}
        initialVersion={activeSheetVersion}
        initialRowCount={activeSheet?.rowCount}
        initialColCount={activeSheet?.colCount}
        initialRows={initialRows}
        initialCols={initialCols}
        initialFrozenRows={activeSheet?.frozenRows}
        initialFrozenCols={activeSheet?.frozenCols}
        workbook={workbook}
        currentSheetName={activeSheet?.name}
        title={title}
        sheets={sheets.map(({ id: sheetId, name }) => ({ id: sheetId, name }))}
        initialSelectedCell={pendingSelectedCell}
        initialToastMessage={pendingToastMessage}
        workbookSearchSession={workbookSearchSession}
        onWorkbookSearchSessionChange={setWorkbookSearchSession}
        onSheetSelect={selectSheet}
        onSheetAdd={addSheet}
        onSheetRename={renameSheet}
        onSheetDelete={deleteSheet}
        onSheetReorder={reorderSheet}
        onSheetDuplicate={duplicateSheet}
        onVersionChange={handleVersionChange}
        onSheetReload={() => loadSpreadsheet(true, activeSheetId)}
        onChartsChange={handleChartsChange}
        onStructureChange={handleStructureChange}
        onMergedRangesChange={handleMergedRangesChange}
        onPivotTablesChange={handlePivotTablesChange}
        onWorkbookImport={importWorkbook}
        workbookExportSheets={workbookExportSheets}
      />
      {canvasTransition && (
        // Preserve the last painted grid until the replacement canvas has
        // completed two animation frames, avoiding a white remount flash.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={canvasTransition.url}
          alt=""
          aria-hidden="true"
          data-sheet-transition="canvas-snapshot"
          style={{
            position: "fixed",
            left: canvasTransition.left,
            top: canvasTransition.top,
            width: canvasTransition.width,
            height: canvasTransition.height,
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />
      )}
    </>
  );
}
