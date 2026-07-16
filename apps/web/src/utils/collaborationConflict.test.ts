import { applyCollaborationOperation, CollaborationCellOperation } from './collaborationConflict';
import { SheetData } from '@/types/spreadsheet';

const operations: CollaborationCellOperation[] = [
  { sheetId: 'sheet-1', row: 0, col: 0, value: 'first', sequence: 1 },
  { sheetId: 'sheet-1', row: 0, col: 0, value: 'latest', sequence: 3 },
  { sheetId: 'sheet-1', row: 0, col: 0, value: 'middle', sequence: 2 },
];

function applyAll(input: CollaborationCellOperation[]) {
  const sequences = new Map<string, number>();
  return input.reduce((data, operation) => applyCollaborationOperation(data, operation, sequences), {} as SheetData);
}

describe('collaboration conflict convergence', () => {
  it.each([
    { arrivalOrder: operations },
    { arrivalOrder: [...operations].reverse() },
    { arrivalOrder: [operations[1], operations[0], operations[2]] },
  ])('converges to the highest server sequence regardless of arrival order', ({ arrivalOrder }) => {
    expect(applyAll(arrivalOrder)[0][0].value).toBe('latest');
  });

  it('deduplicates replayed operations', () => {
    const sequences = new Map<string, number>();
    const first = applyCollaborationOperation({}, operations[1], sequences);
    expect(applyCollaborationOperation(first, operations[1], sequences)).toBe(first);
  });

  it('tracks versions independently for each sheet and cell', () => {
    const sequences = new Map<string, number>();
    let data = applyCollaborationOperation({}, operations[1], sequences);
    data = applyCollaborationOperation(data, { sheetId: 'sheet-1', row: 0, col: 1, value: 'other', sequence: 1 }, sequences);
    expect(data[0][0].value).toBe('latest');
    expect(data[0][1].value).toBe('other');
  });
});
