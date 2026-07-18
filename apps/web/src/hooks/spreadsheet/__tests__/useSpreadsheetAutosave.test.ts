import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { useSpreadsheetAutosave } from '../useSpreadsheetAutosave';

jest.mock('@/lib/api', () => ({
  api: { spreadsheets: { updateCells: jest.fn() } },
}));

const updateCells = jest.mocked(api.spreadsheets.updateCells);

describe('useSpreadsheetAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces and merges repeated changes to the same cell', async () => {
    updateCells.mockResolvedValue({ cells: [], version: 3 });
    const onSaved = jest.fn();
    const onBroadcast = jest.fn();
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({ sheetId: 'sheet-1', onSaved, onBroadcast }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 1, col: 2, value: 'old', formula: null, format: null },
      ]);
      result.current.queueChanges([
        { row: 1, col: 2, value: 'new', formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(updateCells).toHaveBeenCalledTimes(1));
    expect(updateCells.mock.calls[0][1]).toEqual([
      { row: 1, col: 2, value: 'new', formula: null, format: null },
    ]);
    expect(updateCells.mock.calls[0][2]).toBeUndefined();
    expect(updateCells.mock.calls[0][3]).toEqual(expect.any(String));
    expect(onSaved).toHaveBeenCalledWith(3);
    expect(onBroadcast).toHaveBeenCalledWith(updateCells.mock.calls[0][1]);
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });

  it('retries an uncertain request with the same idempotency key', async () => {
    updateCells
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ cells: [], version: 4, replayed: true });
    const { result } = renderHook(() =>
      useSpreadsheetAutosave({ sheetId: 'sheet-1' }),
    );

    act(() => {
      result.current.queueChanges([
        { row: 0, col: 0, value: 1, formula: null, format: null },
      ]);
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => result.current.flush());
    expect(updateCells).toHaveBeenCalledTimes(2);
    expect(updateCells.mock.calls[1][3]).toBe(updateCells.mock.calls[0][3]);
    expect(result.current.status).toBe('saved');
  });
});
