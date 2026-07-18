"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearAuthSession } from "@/lib/auth-session";
import Spreadsheet from "@/components/spreadsheet/Spreadsheet";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";
import {
  SpreadsheetErrorState,
  SpreadsheetLoadingState,
} from "@/components/ui/PageLoadState";
import type { SheetData } from "@/types/spreadsheet";
import { deserializeCellFormat } from "@/utils/cellPersistence";

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
  const [title, setTitle] = useState("");

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

  const loadSpreadsheet = useCallback(async () => {
    if (!id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await api.spreadsheets.get(id, controller.signal);
      if (requestId !== requestRef.current) return;
      setTitle(res.name || "Untitled Spreadsheet");
      const sheets = res.sheets || [];
      if (sheets.length > 0) {
        const firstSheet = sheets[0];
        setActiveSheetId(firstSheet.id);
        setActiveSheetVersion(firstSheet.version ?? 0);

        const sheetData: SheetData = {};
        firstSheet.cells?.forEach((cell) => {
          if (!sheetData[cell.row]) sheetData[cell.row] = {};
          sheetData[cell.row][cell.col] = {
            value: cell.value,
            formula: cell.formula ?? undefined,
            ...deserializeCellFormat(cell.format),
          };
        });
        setData(sheetData);

        if (firstSheet.charts && Array.isArray(firstSheet.charts)) {
          setInitialCharts(firstSheet.charts);
        }
      } else {
        setData({});
        setActiveSheetId(null);
        setInitialCharts([]);
      }
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        console.error("Failed to load spreadsheet:", err);
        if (err instanceof ApiError && err.status === 401) {
          clearAuthSession();
          router.replace("/login");
        } else if (err instanceof ApiError && err.status === 403) {
          setError("이 문서를 열 권한이 없습니다. 소유자에게 접근 권한을 요청해 주세요.");
        } else if (err instanceof ApiError && err.status === 404) {
          setError("문서가 삭제되었거나 주소가 올바르지 않습니다.");
        } else if (err instanceof DOMException && err.name === "TimeoutError") {
          setError("서버 응답이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
        } else {
          setError("문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        if (requestId === requestRef.current && !controller.signal.aborted) setLoading(false);
      }
  }, [id, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadSpreadsheet();
    return () => abortRef.current?.abort();
  }, [authLoading, user, loadSpreadsheet]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <SpreadsheetLoadingState />
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return (
      <SpreadsheetLoadingState />
    );
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
    <Spreadsheet
      key={activeSheetId}
      initialData={data}
      initialCharts={initialCharts}
      spreadsheetId={id}
      activeSheetId={activeSheetId}
      initialVersion={activeSheetVersion}
      title={title}
    />
  );
}
