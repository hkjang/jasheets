"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, CellVersionConflictError } from "@/lib/api";
import type { PersistedCellUpdate } from "@/utils/cellPersistence";
import {
  IndexedDbChangeStore,
  type OfflineChange,
  type OfflineChangeStore,
} from "@/utils/offlineChangeQueue";

export type AutosaveStatus = "saved" | "unsaved" | "saving" | "error";

interface UseSpreadsheetAutosaveOptions {
  sheetId?: string | null;
  userId?: string | null;
  debounceMs?: number;
  onSaved?: (version: number) => void;
  onBroadcast?: (updates: PersistedCellUpdate[]) => void;
  onError?: (error: Error) => void;
  getExpectedVersion?: () => number | undefined;
  onConflictVersion?: (version: number) => void;
  outboxStore?: OfflineChangeStore<AutosaveBatch>;
}

export interface AutosaveBatch {
  sheetId: string;
  userId: string;
  idempotencyKey: string;
  updates: PersistedCellUpdate[];
  expectedVersion?: number;
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
  userId,
  debounceMs = 600,
  onSaved,
  onBroadcast,
  onError,
  getExpectedVersion,
  onConflictVersion,
  outboxStore,
}: UseSpreadsheetAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const bufferRef = useRef(new Map<string, PersistedCellUpdate>());
  const retryBatchRef = useRef<AutosaveBatch | null>(null);
  const bufferedBatchRef = useRef<AutosaveBatch | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeFlushRef = useRef<Promise<void> | null>(null);
  const durabilityChainRef = useRef<Promise<void>>(Promise.resolve());
  const durabilityErrorRef = useRef<Error | null>(null);
  const defaultStoreRef = useRef<OfflineChangeStore<AutosaveBatch> | null>(null);
  const defaultStoreScopeRef = useRef<string | null>(null);

  const getOutboxStore = useCallback((): OfflineChangeStore<AutosaveBatch> | null => {
    if (outboxStore) return outboxStore;
    if (!sheetId || !userId || typeof indexedDB === "undefined") return null;
    if (!defaultStoreRef.current || defaultStoreScopeRef.current !== userId) {
      defaultStoreRef.current = new IndexedDbChangeStore<AutosaveBatch>(
        `jasheets-autosave-${userId}`,
        "batches",
      );
      defaultStoreScopeRef.current = userId;
    }
    return defaultStoreRef.current;
  }, [outboxStore, sheetId, userId]);

  const persistBatch = useCallback((batch: AutosaveBatch): Promise<void> => {
    const store = getOutboxStore();
    if (!store) return Promise.resolve();
    const change: OfflineChange<AutosaveBatch> = {
      id: batch.idempotencyKey,
      payload: batch,
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
    };
    const persisted = durabilityChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await store.put(change);
        durabilityErrorRef.current = null;
      });
    durabilityChainRef.current = persisted.catch((error) => {
      durabilityErrorRef.current = error instanceof Error
        ? error
        : new Error("오프라인 저장소 기록에 실패했습니다.");
    });
    return persisted;
  }, [getOutboxStore]);

  const flush = useCallback(async function flushAutosave(): Promise<void> {
    if (!sheetId) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (activeFlushRef.current) {
      const active = activeFlushRef.current;
      return active.then(() => {
        if (retryBatchRef.current || bufferRef.current.size > 0) return flushAutosave();
      });
    }

    const run = async () => {
      let didStart = false;
      let conflictRetries = 0;
      while (true) {
        let batch = retryBatchRef.current;
        if (!batch) {
          await durabilityChainRef.current;
          if (durabilityErrorRef.current) throw durabilityErrorRef.current;
          const store = getOutboxStore();
          const recovered = store
            ? (await store.list()).find((change) =>
              change.status === "pending"
              && change.payload.sheetId === sheetId
              && change.payload.userId === (userId ?? "anonymous"),
            )
            : undefined;
          if (recovered) {
            batch = recovered.payload;
          } else if (bufferRef.current.size > 0) {
            const buffered = bufferedBatchRef.current;
            const updates = [...bufferRef.current.values()].slice(0, 1000);
            batch = buffered ?? {
              sheetId,
              userId: userId ?? "anonymous",
              idempotencyKey: createIdempotencyKey(),
              updates,
              expectedVersion: getExpectedVersion?.(),
            };
            batch = { ...batch, updates };
            await persistBatch(batch);
          } else {
            break;
          }
          if (bufferedBatchRef.current?.idempotencyKey === batch.idempotencyKey) {
            batch.updates.forEach(({ row, col }) =>
              bufferRef.current.delete(`${row}:${col}`),
            );
            bufferedBatchRef.current = null;
          }
          retryBatchRef.current = batch;
        }

        if (!didStart) {
          didStart = true;
          setStatus("saving");
        }
        try {
          const result = await api.spreadsheets.updateCells(
            sheetId,
            batch.updates,
            batch.expectedVersion,
            batch.idempotencyKey,
          );
          await getOutboxStore()?.delete(batch.idempotencyKey);
          retryBatchRef.current = null;
          conflictRetries = 0;
          onSaved?.(result.version);
          onBroadcast?.(batch.updates);
        } catch (error) {
          if (error instanceof CellVersionConflictError && conflictRetries < 3) {
            conflictRetries += 1;
            retryBatchRef.current = { ...batch, expectedVersion: error.currentVersion };
            await persistBatch(retryBatchRef.current);
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
      if (didStart) setStatus("saved");
    };

    const promise = run().finally(() => {
      activeFlushRef.current = null;
    });
    activeFlushRef.current = promise;
    return promise;
  }, [getExpectedVersion, getOutboxStore, onBroadcast, onConflictVersion, onError, onSaved, persistBatch, sheetId, userId]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queueChanges = useCallback(
    (updates: PersistedCellUpdate[]) => {
      if (!sheetId || updates.length === 0) return;
      updates.forEach((update) => {
        bufferRef.current.set(`${update.row}:${update.col}`, update);
      });
      const batch = bufferedBatchRef.current ?? {
        sheetId,
        userId: userId ?? "anonymous",
        idempotencyKey: createIdempotencyKey(),
        updates: [],
        expectedVersion: getExpectedVersion?.(),
      };
      bufferedBatchRef.current = {
        ...batch,
        updates: [...bufferRef.current.values()].slice(0, 1000),
      };
      void persistBatch(bufferedBatchRef.current).catch((error) => {
        const saveError = error instanceof Error ? error : new Error("오프라인 저장소 기록에 실패했습니다.");
        setStatus("error");
        onError?.(saveError);
      });
      setStatus("unsaved");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flush().catch(() => undefined);
      }, debounceMs);
    },
    [debounceMs, flush, getExpectedVersion, onError, persistBatch, sheetId, userId],
  );

  useEffect(() => {
    const handleOnline = () => {
      if (retryBatchRef.current || bufferRef.current.size > 0) {
        void flushRef.current().catch(() => undefined);
      }
    };
    window.addEventListener("online", handleOnline);
    if (getOutboxStore()) void flushRef.current().catch(() => undefined);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [getOutboxStore]);

  return { status, queueChanges, flush };
}
