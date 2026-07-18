import { renderHook } from '@testing-library/react';
import { useSpreadsheetView } from '../useSpreadsheetView';

describe('useSpreadsheetView', () => {
  it('uses persisted sheet dimensions for the grid and accessibility config', () => {
    const { result } = renderHook(() => useSpreadsheetView({
      initialRowCount: 120,
      initialColCount: 40,
    }));

    expect(result.current.rows).toHaveLength(120);
    expect(result.current.columns).toHaveLength(40);
    expect(result.current.config).toMatchObject({
      totalRows: 120,
      totalCols: 40,
    });
  });
});
