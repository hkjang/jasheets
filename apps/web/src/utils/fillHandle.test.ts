import { createFillUpdates } from './fillHandle';

describe('spreadsheet fill handle', () => {
  it('extends numeric series vertically', () => {
    const data = { 0: { 0: { value: 1 } }, 1: { 0: { value: 3 } } };
    expect(createFillUpdates(data, { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } }, { start: { row: 0, col: 0 }, end: { row: 4, col: 0 } }))
      .toEqual([{ row: 2, col: 0, value: '5' }, { row: 3, col: 0, value: '7' }, { row: 4, col: 0, value: '9' }]);
  });

  it('repeats non-series values', () => {
    const data = { 0: { 0: { value: 'A' }, 1: { value: 'B' } } };
    expect(createFillUpdates(data, { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } }, { start: { row: 0, col: 0 }, end: { row: 0, col: 3 } }))
      .toEqual([{ row: 0, col: 2, value: 'A' }, { row: 0, col: 3, value: 'B' }]);
  });

  it('moves relative formula references while preserving anchors', () => {
    const data = { 0: { 0: { value: 1, formula: '=B1+$C$1' } } };
    expect(createFillUpdates(data, { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }, { start: { row: 0, col: 0 }, end: { row: 2, col: 0 } }))
      .toEqual([{ row: 1, col: 0, value: '=B2+$C$1' }, { row: 2, col: 0, value: '=B3+$C$1' }]);
  });
});
