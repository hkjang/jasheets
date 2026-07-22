import { act, renderHook, waitFor } from "@testing-library/react";
import { api } from "@/lib/api";
import type { OfflineChange, OfflineChangeStore } from "@/utils/offlineChangeQueue";
import {
  type AutosaveBatch,
  useSpreadsheetAutosave,
} from "../useSpreadsheetAutosave";

jest.mock("@/lib/api", () => ({
  CellVersionConflictError: class CellVersionConflictError extends Error {
    constructor(readonly currentVersion: number) {
      super("version conflict");
    }
  },
  api: { spreadsheets: { updateCells: jest.fn() } },
}));

const updateCells = jest.mocked(api.spreadsheets.updateCells);

class TrackingStore implements OfflineChangeStore<AutosaveBatch> {
  changes = new Map<string, OfflineChange<AutosaveBatch>>();
  events: string[] = [];

  async list() {
    return [...this.changes.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  async put(change: OfflineChange<AutosaveBatch>) {
    this.events.push(`put:${change.id}`);
    this.changes.set(change.id, change);
  }

  async delete(id: string) {
    this.events.push(`delete:${id}`);
    this.changes.delete(id);
  }
}

describe("useSpreadsheetAutosave", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("debounces and merges repeated changes to the same cell", async () => {
    updateCells.mockResolvedValue({ cells: [], version: 3 });
    const onSaved = jest.fn();
    const onBroadcast = jest.fn();
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({ sheetId: "sheet-1", onSaved, onBroadcast }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 1, col: 2, value: "old", formula: null, format: null },
      ]);
      result.current.queueChanges([
        { row: 1, col: 2, value: "new", formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(updateCells).toHaveBeenCalledTimes(1));
    expect(updateCells.mock.calls[0][1]).toEqual([
      { row: 1, col: 2, value: "new", formula: null, format: null },
    ]);
    expect(updateCells.mock.calls[0][2]).toBeUndefined();
    expect(updateCells.mock.calls[0][3]).toEqual(expect.any(String));
    expect(onSaved).toHaveBeenCalledWith(3);
    expect(onBroadcast).toHaveBeenCalledWith(updateCells.mock.calls[0][1]);
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  it("retries an uncertain request with the same idempotency key", async () => {
    updateCells
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ cells: [], version: 4, replayed: true });
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({ sheetId: "sheet-1" }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 0, col: 0, value: 1, formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    await act(async () => result.current.flush());
    expect(updateCells).toHaveBeenCalledTimes(2);
    expect(updateCells.mock.calls[1][3]).toBe(updateCells.mock.calls[0][3]);
    expect(result.current.status).toBe("saved");
  });

  it("uses the latest sheet version for optimistic concurrency control", async () => {
    updateCells.mockResolvedValue({ cells: [], version: 8 });
    let version = 7;
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({
        sheetId: "sheet-1",
        getExpectedVersion: () => version,
      }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 2, col: 3, value: "safe", formula: null, format: null },
      ]);
      version = 7;
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(updateCells).toHaveBeenCalledTimes(1));
    expect(updateCells.mock.calls[0][2]).toBe(7);
  });

  it("rebases and retries a conflicting batch without losing edits", async () => {
    const { CellVersionConflictError } = jest.requireMock("@/lib/api") as {
      CellVersionConflictError: new (version: number) => Error;
    };
    updateCells
      .mockRejectedValueOnce(new CellVersionConflictError(9))
      .mockResolvedValueOnce({ cells: [], version: 10 });
    let version = 8;
    const onConflictVersion = jest.fn((next: number) => {
      version = next;
    });
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({
        sheetId: "sheet-1",
        getExpectedVersion: () => version,
        onConflictVersion,
      }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 4, col: 5, value: "merged", formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(onConflictVersion).toHaveBeenCalledWith(9);
    expect(updateCells).toHaveBeenCalledTimes(2);
    expect(updateCells.mock.calls[0][2]).toBe(8);
    expect(updateCells.mock.calls[1][2]).toBe(9);
    expect(updateCells.mock.calls[1][1]).toEqual(updateCells.mock.calls[0][1]);
    expect(updateCells.mock.calls[1][3]).toBe(updateCells.mock.calls[0][3]);
  });

  it("commits a batch to the durable outbox before sending and deletes it after success", async () => {
    const store = new TrackingStore();
    updateCells.mockImplementation(async () => {
      expect(store.changes.size).toBe(1);
      return { cells: [], version: 2 };
    });
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({
        sheetId: "sheet-1",
        userId: "user-1",
        outboxStore: store,
      }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 0, col: 0, value: "durable", formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(store.events[0]).toEqual(expect.stringMatching(/^put:/));
    expect(store.events.at(-1)).toEqual(expect.stringMatching(/^delete:/));
    expect(store.changes.size).toBe(0);
  });

  it("recovers a failed batch after remount with the same idempotency key", async () => {
    const store = new TrackingStore();
    updateCells.mockRejectedValueOnce(new Error("offline"));
    const first = renderHook(() =>
      useSpreadsheetAutosave({
        sheetId: "sheet-1",
        userId: "user-1",
        outboxStore: store,
      }),
    );

    act(() => {
      first.result.current.queueChanges([
        { row: 2, col: 4, value: "survives", formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(first.result.current.status).toBe("error"));
    const originalKey = [...store.changes.keys()][0];
    first.unmount();

    updateCells.mockResolvedValueOnce({ cells: [], version: 7 });
    const second = renderHook(() =>
      useSpreadsheetAutosave({
        sheetId: "sheet-1",
        userId: "user-1",
        outboxStore: store,
      }),
    );

    await waitFor(() => expect(updateCells).toHaveBeenCalledTimes(2));
    expect(updateCells.mock.calls[1][1]).toEqual([
      { row: 2, col: 4, value: "survives", formula: null, format: null },
    ]);
    expect(updateCells.mock.calls[1][3]).toBe(originalKey);
    await waitFor(() => expect(store.changes.size).toBe(0));
    await waitFor(() => expect(second.result.current.status).toBe("saved"));
  });
});
