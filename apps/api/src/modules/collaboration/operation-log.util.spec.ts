import { reduceOperationLog } from './operation-log.util';

describe('collaboration operation snapshots', () => {
  const operations = [
    { sequence: 3, event: 'cell-updated', payload: { row: 0, col: 0, value: 'latest' } },
    { sequence: 1, event: 'cell-updated', payload: { row: 0, col: 0, value: 'first' } },
    { sequence: 2, event: 'cells-updated', payload: { updates: [{ row: 1, col: 0, value: 2 }] } },
  ];

  it('rebuilds the same state regardless of input order', () => {
    expect(reduceOperationLog(operations)).toEqual(reduceOperationLog([...operations].reverse()));
    expect(reduceOperationLog(operations)).toEqual([
      { row: 0, col: 0, value: 'latest', formula: undefined },
      { row: 1, col: 0, value: 2, formula: undefined },
    ]);
  });

  it('continues deterministically from a previous snapshot', () => {
    expect(reduceOperationLog([
      { sequence: 4, event: 'cell-updated', payload: { row: 0, col: 1, value: 4 } },
    ], [{ row: 0, col: 0, value: 3 }])).toEqual([
      { row: 0, col: 0, value: 3 },
      { row: 0, col: 1, value: 4, formula: undefined },
    ]);
  });
});
