import { SheetData } from '@/types/spreadsheet';
import { recalculate } from '../RecalculationEngine';
import {
  LARGE_SHEET_SCENARIO,
  PERFORMANCE_BUDGET_MS,
} from '../performanceBudgets';
import { buildAxisGeometry, getVisibleRange } from '../viewportGeometry';

describe('large-sheet performance budgets', () => {
  it('indexes and locates a viewport within budget', () => {
    const startedAt = performance.now();
    const rows = buildAxisGeometry(LARGE_SHEET_SCENARIO.rows, [], 25);
    const columns = buildAxisGeometry(LARGE_SHEET_SCENARIO.columns, [], 100);
    const rowRange = getVisibleRange(rows, 1_250_000, 800);
    const columnRange = getVisibleRange(columns, 50_000, 1_200);
    const elapsed = performance.now() - startedAt;

    expect(rowRange.end - rowRange.start).toBeLessThan(40);
    expect(columnRange.end - columnRange.start).toBeLessThan(20);
    expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS.viewportIndex);
  });

  it('incrementally recalculates a large formula set within budget', () => {
    const data: SheetData = { 0: { 0: { value: 10 } } };
    for (let row = 1; row <= LARGE_SHEET_SCENARIO.formulaCells; row++) {
      data[row] = {
        0: {
          formula: row === 1 ? '=A1+1' : '=1+1',
          value: -1,
          displayValue: '-1',
        },
      };
    }

    const startedAt = performance.now();
    recalculate(data, {}, [{ row: 0, col: 0 }]);
    const elapsed = performance.now() - startedAt;

    expect(data[1][0].value).toBe(11);
    expect(data[LARGE_SHEET_SCENARIO.formulaCells][0].value).toBe(-1);
    expect(elapsed).toBeLessThan(PERFORMANCE_BUDGET_MS.incrementalRecalculation);
  });
});
