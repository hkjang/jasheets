import { createCSVContent, createExcelSafeSheetNames, createXLSXWorkbook, createXLSXWorksheet, exportToCSV } from './export';

describe('XLSX export', () => {
  it('preserves formulas and safe hyperlinks while omitting unsafe links', () => {
    const worksheet = createXLSXWorksheet({
      0: {
        0: {
          value: 'Documentation',
          link: { url: '  https://example.com/docs  ' },
        },
        1: {
          value: 'Unsafe',
          link: { url: 'javascript:alert(1)' },
        },
        2: {
          value: 2,
          formula: '=1+1',
          link: { url: 'mailto:help@example.com' },
        },
      },
    });

    expect(worksheet.A1).toMatchObject({
      v: 'Documentation',
      l: { Target: 'https://example.com/docs' },
    });
    expect(worksheet.B1.l).toBeUndefined();
    expect(worksheet.C1).toMatchObject({
      v: 2,
      f: '1+1',
      l: { Target: 'mailto:help@example.com' },
    });
  });

  it('exports formats, supported styles, merges, and row/column presentation', () => {
    const worksheet = createXLSXWorksheet(
      {
        0: {
          0: {
            value: 12.5,
            format: 'currency',
            style: {
              fontWeight: 'bold',
              fontStyle: 'italic',
              color: '#123456',
              backgroundColor: '#abcdef',
              textAlign: 'center',
              verticalAlign: 'middle',
            },
          },
        },
      },
      {
        mergedRanges: [{ startRow: 0, endRow: 1, startCol: 0, endCol: 2 }],
        rows: { 0: { height: 40, hidden: true } },
        columns: { 2: { width: 150, hidden: true } },
      },
    );

    expect(worksheet.A1).toMatchObject({
      z: '$#,##0.00',
      s: {
        font: { bold: true, italic: true, color: { rgb: '123456' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'ABCDEF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      },
    });
    expect(worksheet['!merges']).toEqual([{ s: { r: 0, c: 0 }, e: { r: 1, c: 2 } }]);
    expect(worksheet['!rows']?.[0]).toEqual({ hpx: 40, hidden: true });
    expect(worksheet['!cols']?.[2]).toEqual({ wpx: 150, hidden: true });
  });

  it('creates sheets in workbook order and rejects an empty workbook', () => {
    expect(createXLSXWorkbook([
      { name: 'First', data: {} },
      { name: 'Second', data: { 0: { 0: { value: 'x' } } } },
    ]).SheetNames).toEqual(['First', 'Second']);
    expect(() => createXLSXWorkbook([])).toThrow('At least one sheet is required');
  });

  it('sanitizes invalid or colliding Excel tab names and rewrites formulas', () => {
    expect(createExcelSafeSheetNames(['A/B', 'A:B', 'x'.repeat(40)])).toEqual([
      'A B',
      'A B (2)',
      'x'.repeat(31),
    ]);
    const workbook = createXLSXWorkbook([
      { name: 'A/B', data: { 0: { 0: { value: 1 } } } },
      { name: 'Summary', data: { 0: { 0: { value: 1, formula: "='A/B'!A1" } } } },
    ]);

    expect(workbook.SheetNames).toEqual(['A B', 'Summary']);
    expect(workbook.Sheets.Summary.A1.f).toBe("'A B'!A1");
  });
});

describe('CSV export', () => {
  it('creates an Excel-compatible UTF-8 CSV and escapes special values', () => {
    expect(
      createCSVContent({
        0: {
          0: { value: 'Name' },
          1: { value: 'Notes' },
        },
        1: {
          0: { value: 'Alice, Inc.' },
          1: { value: 'Line 1\nLine "2"' },
        },
      }),
    ).toBe(
      '\uFEFFName,Notes\r\n"Alice, Inc.","Line 1\nLine ""2"""\r\n',
    );
  });

  it('uses a Blob URL for downloads and revokes it after the click', () => {
    jest.useFakeTimers();
    const createObjectURL = jest.fn(() => 'blob:csv-export');
    const revokeObjectURL = jest.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    exportToCSV({ 0: { 0: { value: '한글' } } }, 'report.csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download="report.csv"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv-export');

    click.mockRestore();
    jest.useRealTimers();
  });

  it('does not create a download for an empty sheet', () => {
    const createObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });

    exportToCSV({});

    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
