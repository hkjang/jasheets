import { rewriteSheetReferences } from './sheet-reference.util';

describe('sheet reference rewriting', () => {
  it('renames quoted and unquoted references without touching string literals', () => {
    expect(rewriteSheetReferences(
      '=Sheet1!A1+SUM(\'Sheet1\'!$B$2:C3)+"Sheet1!A1"',
      'sheet1',
      "Q1 O'Brien",
    )).toBe(
      '=\'Q1 O\'\'Brien\'!A1+SUM(\'Q1 O\'\'Brien\'!$B$2:C3)+"Sheet1!A1"',
    );
  });

  it('marks deleted sheet references as invalid', () => {
    expect(rewriteSheetReferences('=SUM(Data!A1:B4)', 'Data')).toBe('=SUM(#REF!)');
  });
});
