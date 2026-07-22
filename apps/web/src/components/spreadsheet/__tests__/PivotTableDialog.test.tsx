import { fireEvent, render, screen } from '@testing-library/react';
import PivotTableDialog from '../PivotTableDialog';
import type { ManagedPivotTable } from '@/utils/managedPivots';

const data = {
  0: { 0: { value: 'Region' }, 1: { value: 'Sales' } },
  1: { 0: { value: 'East' }, 1: { value: 10 } },
};
const selection = { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } };

describe('PivotTableDialog', () => {
  it('creates a named pivot with an explicit target', () => {
    const onSave = jest.fn();
    render(<PivotTableDialog isOpen onClose={jest.fn()} onSave={onSave} onDelete={jest.fn()} selection={selection} data={data} pivotTables={[]} />);
    fireEvent.click(screen.getAllByRole('button', { name: '값' })[1]);
    fireEvent.click(screen.getByRole('button', { name: '생성' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: '피벗 테이블 1',
      targetCell: 'A5',
      config: expect.objectContaining({ sourceRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 } }),
    }));
  });

  it('loads an existing definition for editing and exposes deletion', () => {
    const pivot: ManagedPivotTable = {
      id: 'pivot-1', name: '매출 요약', targetCell: 'D4',
      config: { sourceRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, rows: ['Region'], cols: [], values: [{ field: 'Sales', aggregation: 'SUM' }] },
    };
    const onDelete = jest.fn();
    render(<PivotTableDialog isOpen onClose={jest.fn()} onSave={jest.fn()} onDelete={onDelete} selection={null} data={data} pivotTables={[pivot]} />);
    fireEvent.click(screen.getByRole('button', { name: '매출 요약' }));
    expect(screen.getByDisplayValue('D4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경 저장' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '매출 요약 삭제' }));
    expect(onDelete).toHaveBeenCalledWith(pivot);
  });

  it('configures filters, sorting, and grand totals', () => {
    const onSave = jest.fn();
    render(<PivotTableDialog isOpen onClose={jest.fn()} onSave={onSave} onDelete={jest.fn()} selection={selection} data={data} pivotTables={[]} />);
    fireEvent.click(screen.getAllByRole('button', { name: '값' })[1]);
    fireEvent.click(screen.getByRole('button', { name: '+ 필터 추가' }));
    fireEvent.change(screen.getByLabelText('필터 1 값'), { target: { value: 'East' } });
    fireEvent.change(screen.getByLabelText('행 정렬'), { target: { value: 'LABEL:DESC' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '행 총계' }));
    fireEvent.click(screen.getByRole('button', { name: '생성' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        filters: [{ field: 'Region', operator: 'EQUALS', value: 'East' }],
        rowSort: { by: 'LABEL', direction: 'DESC' },
        rowGrandTotals: true,
      }),
    }));
  });
});
