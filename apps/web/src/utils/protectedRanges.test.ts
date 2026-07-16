import { canEditCell, containsCell } from './protectedRanges';

const protectedRange = {
  id: 'range-1',
  range: { start: { row: 1, col: 1 }, end: { row: 3, col: 2 } },
  ownerId: 'owner',
  allowedUserIds: ['editor'],
};

describe('protected ranges', () => {
  it('detects cells inside normalized boundaries', () => {
    expect(containsCell(protectedRange, { row: 2, col: 2 })).toBe(true);
    expect(containsCell(protectedRange, { row: 0, col: 2 })).toBe(false);
  });

  it('allows owners and explicitly allowed users', () => {
    expect(canEditCell([protectedRange], { row: 2, col: 2 }, 'owner')).toBe(true);
    expect(canEditCell([protectedRange], { row: 2, col: 2 }, 'editor')).toBe(true);
  });

  it('rejects guests and unrelated users only inside the range', () => {
    expect(canEditCell([protectedRange], { row: 2, col: 2 }, 'viewer')).toBe(false);
    expect(canEditCell([protectedRange], { row: 2, col: 2 })).toBe(false);
    expect(canEditCell([protectedRange], { row: 8, col: 8 }, 'viewer')).toBe(true);
  });
});
