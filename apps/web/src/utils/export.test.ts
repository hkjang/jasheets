import { createCSVContent, createXLSXWorksheet, exportToCSV } from './export';

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
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
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
