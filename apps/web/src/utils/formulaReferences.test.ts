import { rewriteFormulaForStructuralChange, rewriteSheetNameReferences } from './formulaReferences';

describe('structural formula reference rewriting', () => {
  it('moves relative and absolute references after row insertion', () => {
    expect(rewriteFormulaForStructuralChange('=A1+$B$2+C$3', { axis: 'row', type: 'insert', index: 1 }))
      .toBe('=A1+$B$3+C$4');
  });

  it('moves columns and preserves anchor markers', () => {
    expect(rewriteFormulaForStructuralChange('=$A1+B$2', { axis: 'column', type: 'insert', index: 0 }))
      .toBe('=$B1+C$2');
  });

  it('returns REF for a deleted cell and shrinks ranges', () => {
    expect(rewriteFormulaForStructuralChange('=A2+B3', { axis: 'row', type: 'delete', index: 1 }))
      .toBe('=#REF!+B2');
    expect(rewriteFormulaForStructuralChange('=SUM(A1:A3)', { axis: 'row', type: 'delete', index: 1 }))
      .toBe('=SUM(A1:A2)');
  });

  it('expands ranges when insertion occurs inside them', () => {
    expect(rewriteFormulaForStructuralChange('=SUM(A1:C3)', { axis: 'column', type: 'insert', index: 1 }))
      .toBe('=SUM(A1:D3)');
  });

  it('does not rewrite references inside strings', () => {
    expect(rewriteFormulaForStructuralChange('="A2"&A2', { axis: 'row', type: 'delete', index: 1 }))
      .toBe('="A2"&#REF!');
  });
});

describe('sheet name references', () => {
  it('rewrites references when a tab is renamed or deleted', () => {
    expect(rewriteSheetNameReferences('=Data!A1+\'Data\'!B2+"Data!C3"', 'Data', 'Q1 Sales'))
      .toBe("='Q1 Sales'!A1+'Q1 Sales'!B2+\"Data!C3\"");
    expect(rewriteSheetNameReferences('=SUM(Data!A1:B3)', 'Data'))
      .toBe('=SUM(#REF!)');
  });
});
