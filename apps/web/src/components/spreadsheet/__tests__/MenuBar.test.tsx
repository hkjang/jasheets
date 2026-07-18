import { fireEvent, render, screen } from '@testing-library/react';
import MenuBar from '../MenuBar';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('MenuBar data sorting', () => {
  const callbacks = {
    onExportCSV: jest.fn(),
    onPrint: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onCut: jest.fn(),
    onCopy: jest.fn(),
    onPaste: jest.fn(),
    onFind: jest.fn(),
    onShowShortcuts: jest.fn(),
    onVersionHistory: jest.fn(),
    onInsertRow: jest.fn(),
    onInsertCol: jest.fn(),
    onDeleteRow: jest.fn(),
    onDeleteCol: jest.fn(),
    onFreezeRow: jest.fn(),
    onFreezeCol: jest.fn(),
    onFilter: jest.fn(),
    onSortAsc: jest.fn(),
    onSortDesc: jest.fn(),
    onToggleFormulaBar: jest.fn(),
    onToggleGridlines: jest.fn(),
    onDownloadXLSX: jest.fn(),
    onDownloadPDF: jest.fn(),
    onMakeCopy: jest.fn(),
    onEmail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches ascending and descending sheet sorts separately', () => {
    render(<MenuBar {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: '데이터' }));
    fireEvent.click(screen.getByText('시트 정렬 (A-Z)'));
    expect(callbacks.onSortAsc).toHaveBeenCalledTimes(1);
    expect(callbacks.onSortDesc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '데이터' }));
    fireEvent.click(screen.getByText('시트 정렬 (Z-A)'));
    expect(callbacks.onSortDesc).toHaveBeenCalledTimes(1);
    expect(callbacks.onSortAsc).toHaveBeenCalledTimes(1);
  });
});
