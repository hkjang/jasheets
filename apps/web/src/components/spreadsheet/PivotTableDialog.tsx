
import { useState, useMemo } from 'react';
import { SheetData, CellRange, colIndexToLetter } from '@/types/spreadsheet';
import styles from './PivotTableDialog.module.css';

interface PivotTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: any) => void;
  selection: CellRange | null;
  data: SheetData;
}

export default function PivotTableDialog({
  isOpen,
  onClose,
  onCreate,
  selection,
  data,
}: PivotTableDialogProps) {
  if (!isOpen) return null;

  const [rows, setRows] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [values, setValues] = useState<{ field: string; aggregation: string }[]>([]);
  
  // Target cell input (defaults to a safe spot or user can type)
  // For MVP we might just default to "A1 of a new sheet" if we supported new sheets, 
  // or "Current Sheet, 2 rows below data".
  // Let's simplified: user selects range for SOURCE, we put PIVOT at `targetCell`.
  // To verify: we need headers from the selection.

  const possibleHeaders = useMemo(() => {
    if (!selection) return [];
    const headers: string[] = [];
    const r = selection.start.row;
    for (let c = selection.start.col; c <= selection.end.col; c++) {
      const val = data[r]?.[c]?.value;
      headers.push(String(val ?? `Col ${colIndexToLetter(c)}`));
    }
    return headers;
  }, [selection, data]);

  const handleCreate = () => {
    onCreate({
      sourceRange: {
        startRow: selection?.start.row,
        startCol: selection?.start.col,
        endRow: selection?.end.row,
        endCol: selection?.end.col,
      },
      rows,
      cols,
      values,
    });
    onClose();
  };

  const handleAddField = (field: string, type: 'rows' | 'cols') => {
    if (type === 'rows') {
        if (!rows.includes(field)) setRows([...rows, field]);
    } else {
        if (!cols.includes(field)) setCols([...cols, field]);
    }
  };

  const handleAddValue = (field: string) => {
      setValues([...values, { field, aggregation: 'SUM' }]);
  };

  const handleRemoveField = (index: number, type: 'rows' | 'cols' | 'values') => {
      if (type === 'rows') {
          const newRows = [...rows];
          newRows.splice(index, 1);
          setRows(newRows);
      } else if (type === 'cols') {
          const newCols = [...cols];
          newCols.splice(index, 1);
          setCols(newCols);
      } else {
          const newValues = [...values];
          newValues.splice(index, 1);
          setValues(newValues);
      }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3>피벗 테이블 만들기</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.sourceInfo}>
             <strong>선택된 범위: </strong> 
             {selection ? 
               `${colIndexToLetter(selection.start.col)}${selection.start.row + 1}:${colIndexToLetter(selection.end.col)}${selection.end.row + 1}` 
               : '없음'}
          </div>

          <div className={styles.configContainer}>
             <div className={styles.fieldList}>
                <h4>필드 목록</h4>
                {possibleHeaders.map(h => (
                    <div key={h} className={styles.fieldItem}>
                        <span>{h}</span>
                        <div className={styles.fieldActions}>
                            <button onClick={() => handleAddField(h, 'rows')}>행</button>
                            <button onClick={() => handleAddField(h, 'cols')}>열</button>
                            <button onClick={() => handleAddValue(h)}>값</button>
                        </div>
                    </div>
                ))}
             </div>

             <div className={styles.dropZones}>
                <div className={styles.zone}>
                    <h4>행 (Rows)</h4>
                    {rows.map((r, i) => (
                        <div key={i} className={styles.zoneItem}>
                            {r} <button onClick={() => handleRemoveField(i, 'rows')}>×</button>
                        </div>
                    ))}
                </div>
                <div className={styles.zone}>
                    <h4>열 (Columns)</h4>
                    {cols.map((c, i) => (
                        <div key={i} className={styles.zoneItem}>
                            {c} <button onClick={() => handleRemoveField(i, 'cols')}>×</button>
                        </div>
                    ))}
                </div>
                <div className={styles.zone}>
                    <h4>값 (Values)</h4>
                    {values.map((v, i) => (
                        <div key={i} className={styles.zoneItem}>
                            {v.field} ({v.aggregation})
                             <button onClick={() => handleRemoveField(i, 'values')}>×</button>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelButton}>취소</button>
          <button onClick={handleCreate} className={styles.createButton} disabled={!selection}>생성</button>
        </div>
      </div>
    </div>
  );
}
