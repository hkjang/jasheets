"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, CellVersionConflictError } from "@/lib/api";
import type { PersistedCellUpdate } from "@/utils/cellPersistence";

export type AutosaveStatus = "saved" | "unsaved" | "saving" | "error";

interface UseSpreadsheetAutosaveOptions {
  sheetId?: string | null;
  debounceMs?: number;
  onSaved?: (version: number) => void;
  onBroadcast?: (updates: PersistedCellUpdate[]) => void;
  onError?: (error: Error) => void;
  getExpectedVersion?: () => number | undefined;
  onConflictVersion?: (version: number) => void;
}

interface PendingBatch {
  idempotencyKey: string;
  updates: PersistedCellUpdate[];
}

function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function useSpreadsheetAutosave({
  sheetId,
  debounceMs = 600,
  onSaved,
  onBroadcast,
  onError,
  getExpectedVersion,
  onConflictVersion,
}: UseSpreadsheetAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const bufferRef = useRef(new Map<string, PersistedCellUpdate>());
  const retryBatchRef = useRef<PendingBatch | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeFlushRef = useRef<Promise<void> | null>(null);

  const flush = useCallback(async (): Promise<void> => {
    if (!sheetId) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (activeFlushRef.current) return activeFlushRef.current;

    const run = async () => {
      setStatus("saving");
      let conflictRetries = 0;
      while (retryBatchRef.current || bufferRef.current.size > 0) {
        let batch = retryBatchRef.current;
        if (!batch) {
          const updates = [...bufferRef.current.values()].slice(0, 1000);
          updates.forEach(({ row, col }) =>
            bufferRef.current.delete(`${row}:${col}`),
          );
          batch = { idempotencyKey: createIdempotencyKey(), updates };
        }

        try {
          const result = await api.spreadsheets.updateCells(
            sheetId,
            batch.updates,
            getExpectedVersion?.(),
            batch.idempotencyKey,
          );
          retryBatchRef.current = null;
          conflictRetries = 0;
          onSaved?.(result.version);
          onBroadcast?.(batch.updates);
        } catch (error) {
          if (error instanceof CellVersionConflictError && conflictRetries < 3) {
            conflictRetries += 1;
            retryBatchRef.current = batch;
            onConflictVersion?.(error.currentVersion);
            continue;
          }
          retryBatchRef.current = batch;
          const saveError =
            error instanceof Error
              ? error
              : new Error("셀 자동 저장에 실패했습니다.");
          setStatus("error");
          onError?.(saveError);
          throw saveError;
        }
      }
      setStatus("saved");
    };

    const promise = run().finally(() => {
      activeFlushRef.current = null;
    });
    activeFlushRef.current = promise;
    return promise;
  }, [getExpectedVersion, onBroadcast, onConflictVersion, onError, onSaved, sheetId]);

  const queueChanges = useCallback(
    (updates: PersistedCellUpdate[]) => {
      if (!sheetId || updates.length === 0) return;
      updates.forEach((update) => {
        bufferRef.current.set(`${update.row}:${update.col}`, update);
      });
      setStatus("unsaved");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flush().catch(() => undefined);
      }, debounceMs);
    },
    [debounceMs, flush, sheetId],
  );

  useEffect(() => {
    const handleOnline = () => {
      if (retryBatchRef.current || bufferRef.current.size > 0) {
        void flush().catch(() => undefined);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      void flush().catch(() => undefined);
    };
  }, [flush]);

  return { status, queueChanges, flush };
}
