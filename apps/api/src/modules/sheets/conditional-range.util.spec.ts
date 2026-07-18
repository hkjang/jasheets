import { rewriteConditionalRanges } from './conditional-range.util';

describe('conditional formatting range structural changes', () => {
  it('moves and expands ranges for insertions', () => {
    expect(rewriteConditionalRanges(['A2:$C$4'], {
      axis: 'row', type: 'insert', index: 0,
    })).toEqual(['A3:$C$5']);
    expect(rewriteConditionalRanges(['A1:C3'], {
      axis: 'column', type: 'insert', index: 1,
    })).toEqual(['A1:D3']);
  });

  it('shrinks ranges and removes a fully deleted one-dimensional range', () => {
    expect(rewriteConditionalRanges(['A1:A3', 'B2:D2'], {
      axis: 'row', type: 'delete', index: 1,
    })).toEqual(['A1:A2']);
  });

  it('preserves unsupported range syntax instead of corrupting it', () => {
    expect(rewriteConditionalRanges(['A:A'], {
      axis: 'row', type: 'insert', index: 1,
    })).toEqual(['A:A']);
  });
});
