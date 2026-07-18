import type { Patch } from 'immer';
import {
  collectPersistedCellUpdates,
  deserializeCellFormat,
  serializeCellFormat,
} from './cellPersistence';

describe('cell persistence', () => {
  it('collects a nested cell patch with value, formula, and formatting', () => {
    const next = {
      2: {
        3: {
          value: 42,
          formula: '=SUM(A1:A2)',
          style: { fontWeight: 'bold' as const },
          format: 'currency',
        },
      },
    };
    const patches: Patch[] = [{ op: 'replace', path: [2, 3, 'value'], value: 42 }];

    expect(collectPersistedCellUpdates({}, next, patches)).toEqual([
      {
        row: 2,
        col: 3,
        value: 42,
        formula: '=SUM(A1:A2)',
        format: {
          style: { fontWeight: 'bold' },
          numberFormat: 'currency',
        },
      },
    ]);
  });

  it('emits null values for deleted cells and expands row-level patches', () => {
    const previous = { 1: { 0: { value: 'A' }, 1: { value: 'B' } } };
    const patches: Patch[] = [{ op: 'remove', path: [1] }];

    expect(collectPersistedCellUpdates(previous, {}, patches)).toEqual([
      { row: 1, col: 0, value: null, formula: null, format: null },
      { row: 1, col: 1, value: null, formula: null, format: null },
    ]);
  });

  it('reads both structured and legacy style-only formats', () => {
    const format = serializeCellFormat({
      value: 'x',
      style: { color: '#123456' },
      format: 'percent',
      validation: { type: 'number', min: 0 },
    });
    expect(deserializeCellFormat(format)).toEqual({
      style: { color: '#123456' },
      format: 'percent',
      validation: { type: 'number', min: 0 },
    });
    expect(deserializeCellFormat({ color: '#abcdef' })).toEqual({
      style: { color: '#abcdef' },
    });
  });
});
