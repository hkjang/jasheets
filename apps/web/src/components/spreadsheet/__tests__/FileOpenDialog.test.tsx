import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FileOpenDialog from '../FileOpenDialog';
import { importSpreadsheetFile } from '@/utils/fileImport';
import type { ImportResult } from '@/utils/fileImport';

jest.mock('@/utils/fileImport', () => ({
  importSpreadsheetFile: jest.fn(),
  validateImportFile: jest.fn(() => ({ valid: true })),
}));

const parsedWorkbook: ImportResult = {
  sheetName: 'Summary',
  sheetNames: ['Summary', 'Raw'],
  data: { 0: { 0: { value: 'total' } } },
  workbook: {
    sheets: [
      { name: 'Summary', data: { 0: { 0: { value: 'total' } } }, mergedRanges: [], rows: {}, columns: {} },
      { name: 'Raw', data: { 1: { 2: { value: 42 } } }, mergedRanges: [], rows: {}, columns: {} },
    ],
  },
};

describe('FileOpenDialog', () => {
  it('previews every tab and imports in append mode by default', async () => {
    jest.mocked(importSpreadsheetFile).mockResolvedValue(parsedWorkbook);
    const onFileImport = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <FileOpenDialog isOpen onClose={onClose} onFileImport={onFileImport} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'book.xlsx')] } });

    expect(await screen.findByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
    expect(screen.getByText('2개 시트')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '가져오기' }));
    await waitFor(() => expect(onFileImport).toHaveBeenCalledWith(parsedWorkbook, 'append'));
    expect(onClose).toHaveBeenCalled();
  });

  it('requires explicit confirmation before replacing existing tabs', async () => {
    jest.mocked(importSpreadsheetFile).mockResolvedValue(parsedWorkbook);
    const onFileImport = jest.fn().mockResolvedValue(undefined);
    const { container } = render(
      <FileOpenDialog isOpen onClose={jest.fn()} onFileImport={onFileImport} />,
    );
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'book.xlsx')] },
    });
    await screen.findByText('Summary');

    fireEvent.click(screen.getByRole('radio', { name: /기존 탭 교체/ }));
    expect(screen.getByRole('button', { name: '가져오기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: '가져오기' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '가져오기' }));

    await waitFor(() => expect(onFileImport).toHaveBeenCalledWith(parsedWorkbook, 'replace'));
  });
});
