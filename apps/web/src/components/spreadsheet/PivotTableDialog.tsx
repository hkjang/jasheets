import { useEffect, useMemo, useState } from 'react';
import { SheetData, CellRange, cellRefToString, colIndexToLetter } from '@/types/spreadsheet';
import type {
  PivotAggregation,
  PivotConfig,
  PivotFilter,
  PivotFilterOperator,
  PivotSort,
} from '@/utils/pivotLogic';
import type { ManagedPivotTable } from '@/utils/managedPivots';
import styles from './PivotTableDialog.module.css';

interface PivotTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (definition: { id?: string; name: string; targetCell: string; config: PivotConfig }) => void;
  onDelete: (pivot: ManagedPivotTable) => void;
  selection: CellRange | null;
  data: SheetData;
  pivotTables: ManagedPivotTable[];
}

export default function PivotTableDialog({
  isOpen, onClose, onSave, onDelete, selection, data, pivotTables,
}: PivotTableDialogProps) {
  const [editing, setEditing] = useState<ManagedPivotTable | null>(null);
  const [name, setName] = useState('피벗 테이블');
  const [targetCell, setTargetCell] = useState('A1');
  const [rows, setRows] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [values, setValues] = useState<Array<{ field: string; aggregation: PivotAggregation }>>([]);
  const [filters, setFilters] = useState<PivotFilter[]>([]);
  const [rowSort, setRowSort] = useState<PivotSort | undefined>();
  const [colSort, setColSort] = useState<PivotSort | undefined>();
  const [rowGrandTotals, setRowGrandTotals] = useState(false);
  const [columnGrandTotals, setColumnGrandTotals] = useState(false);

  const sourceRange = editing?.config.sourceRange ?? (selection ? {
    startRow: selection.start.row,
    startCol: selection.start.col,
    endRow: selection.end.row,
    endCol: selection.end.col,
  } : null);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name || '피벗 테이블');
      setTargetCell(editing.targetCell || 'A1');
      setRows(editing.config.rows);
      setCols(editing.config.cols);
      setValues(editing.config.values);
      setFilters(editing.config.filters ?? []);
      setRowSort(editing.config.rowSort);
      setColSort(editing.config.colSort);
      setRowGrandTotals(editing.config.rowGrandTotals ?? false);
      setColumnGrandTotals(editing.config.columnGrandTotals ?? false);
      return;
    }
    setName(`피벗 테이블 ${pivotTables.length + 1}`);
    if (selection) setTargetCell(cellRefToString(selection.end.row + 3, selection.start.col));
    setRows([]);
    setCols([]);
    setValues([]);
    setFilters([]);
    setRowSort(undefined);
    setColSort(undefined);
    setRowGrandTotals(false);
    setColumnGrandTotals(false);
  }, [editing, isOpen, pivotTables.length, selection]);

  const possibleHeaders = useMemo(() => {
    if (!sourceRange) return [];
    const headers: string[] = [];
    for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
      headers.push(String(data[sourceRange.startRow]?.[col]?.value ?? `Col ${colIndexToLetter(col)}`));
    }
    return headers;
  }, [sourceRange, data]);

  if (!isOpen) return null;
  const addField = (field: string, type: 'rows' | 'cols') => {
    if (type === 'rows') setRows((current) => current.includes(field) ? current : [...current, field]);
    else setCols((current) => current.includes(field) ? current : [...current, field]);
  };
  const remove = (index: number, type: 'rows' | 'cols' | 'values') => {
    if (type === 'rows') setRows((current) => current.filter((_, i) => i !== index));
    else if (type === 'cols') setCols((current) => current.filter((_, i) => i !== index));
    else setValues((current) => current.filter((_, i) => i !== index));
  };
  const validTarget = /^[A-Z]+[1-9]\d*$/i.test(targetCell.trim());
  const normalizeSort = (sort: PivotSort | undefined): PivotSort | undefined => {
    if (!sort || sort.by !== 'VALUE') return sort;
    return values[0] ? { ...sort, valueField: values[0].field, aggregation: values[0].aggregation } : undefined;
  };
  const filterOperators: Array<{ value: PivotFilterOperator; label: string }> = [
    { value: 'EQUALS', label: '같음' },
    { value: 'NOT_EQUALS', label: '같지 않음' },
    { value: 'CONTAINS', label: '포함' },
    { value: 'NOT_CONTAINS', label: '포함하지 않음' },
    { value: 'GREATER_THAN', label: '보다 큼' },
    { value: 'LESS_THAN', label: '보다 작음' },
    { value: 'IS_BLANK', label: '비어 있음' },
    { value: 'IS_NOT_BLANK', label: '비어 있지 않음' },
  ];

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="피벗 테이블 관리">
    <div className={styles.dialog}>
      <div className={styles.header}><h3>피벗 테이블 관리</h3><button onClick={onClose} className={styles.closeButton} aria-label="닫기">×</button></div>
      <div className={styles.content}>
        <aside className={styles.pivotList}>
          <button className={styles.newPivot} onClick={() => setEditing(null)}>+ 새 피벗</button>
          {pivotTables.map((pivot, index) => <div key={pivot.id ?? index} className={styles.savedPivot}>
            <button onClick={() => setEditing(pivot)}>{pivot.name || `피벗 ${index + 1}`}</button>
            <button className={styles.deleteButton} onClick={() => onDelete(pivot)} aria-label={`${pivot.name || '피벗'} 삭제`}>삭제</button>
          </div>)}
        </aside>
        <div className={styles.editor}>
          {!sourceRange ? <p>새 피벗을 만들려면 원본 데이터 범위를 선택한 뒤 다시 여세요.</p> : <>
            <div className={styles.settingsRow}>
              <label>이름<input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>출력 시작 셀<input value={targetCell} onChange={(event) => setTargetCell(event.target.value.toUpperCase())} aria-invalid={!validTarget} /></label>
            </div>
            <div className={styles.sourceInfo}><strong>원본 범위: </strong>{cellRefToString(sourceRange.startRow, sourceRange.startCol)}:{cellRefToString(sourceRange.endRow, sourceRange.endCol)}</div>
            <div className={styles.configContainer}>
              <div className={styles.fieldList}><h4>필드 목록</h4>{possibleHeaders.map((header) => <div key={header} className={styles.fieldItem}><span>{header}</span><div className={styles.fieldActions}><button onClick={() => addField(header, 'rows')}>행</button><button onClick={() => addField(header, 'cols')}>열</button><button onClick={() => setValues((current) => [...current, { field: header, aggregation: 'SUM' }])}>값</button></div></div>)}</div>
              <div className={styles.dropZones}>
                {([['행', rows, 'rows'], ['열', cols, 'cols']] as const).map(([label, fields, type]) => <div className={styles.zone} key={type}><h4>{label}</h4>{fields.map((field, index) => <div key={`${field}-${index}`} className={styles.zoneItem}>{field}<button onClick={() => remove(index, type)}>×</button></div>)}</div>)}
                <div className={styles.zone}><h4>값</h4>{values.map((value, index) => <div key={`${value.field}-${index}`} className={styles.zoneItem}>{value.field}<select aria-label={`${value.field} 집계 방식`} value={value.aggregation} onChange={(event) => setValues((current) => current.map((item, i) => i === index ? { ...item, aggregation: event.target.value as PivotAggregation } : item))}>{(['SUM', 'COUNT', 'AVERAGE', 'MIN', 'MAX'] as const).map((aggregation) => <option key={aggregation}>{aggregation}</option>)}</select><button onClick={() => remove(index, 'values')}>×</button></div>)}</div>
              </div>
            </div>
            <div className={styles.advancedSettings}>
              <div>
                <h4>필터</h4>
                {filters.map((filter, index) => (
                  <div className={styles.filterRow} key={`${filter.field}-${index}`}>
                    <select
                      aria-label={`필터 ${index + 1} 필드`}
                      value={filter.field}
                      onChange={(event) => setFilters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item))}
                    >
                      {possibleHeaders.map((header) => <option key={header}>{header}</option>)}
                    </select>
                    <select
                      aria-label={`필터 ${index + 1} 조건`}
                      value={filter.operator}
                      onChange={(event) => setFilters((current) => current.map((item, itemIndex) => {
                        if (itemIndex !== index) return item;
                        const operator = event.target.value as PivotFilterOperator;
                        return ['IS_BLANK', 'IS_NOT_BLANK'].includes(operator)
                          ? { field: item.field, operator }
                          : { ...item, operator, value: item.value ?? '' };
                      }))}
                    >
                      {filterOperators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                    </select>
                    {!['IS_BLANK', 'IS_NOT_BLANK'].includes(filter.operator) && (
                      <input
                        aria-label={`필터 ${index + 1} 값`}
                        value={String(filter.value ?? '')}
                        onChange={(event) => setFilters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                      />
                    )}
                    <button type="button" onClick={() => setFilters((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={possibleHeaders.length === 0}
                  onClick={() => setFilters((current) => [...current, { field: possibleHeaders[0], operator: 'EQUALS', value: '' }])}
                >
                  + 필터 추가
                </button>
              </div>
              <div className={styles.summaryOptions}>
                <label>행 정렬
                  <select value={rowSort ? `${rowSort.by ?? 'LABEL'}:${rowSort.direction}` : ''} onChange={(event) => {
                    if (!event.target.value) setRowSort(undefined);
                    else { const [by, direction] = event.target.value.split(':'); setRowSort({ by: by as 'LABEL' | 'VALUE', direction: direction as 'ASC' | 'DESC', ...(by === 'VALUE' && values[0] ? { valueField: values[0].field, aggregation: values[0].aggregation } : {}) }); }
                  }}>
                    <option value="">기본</option><option value="LABEL:ASC">라벨 오름차순</option><option value="LABEL:DESC">라벨 내림차순</option><option value="VALUE:ASC">값 오름차순</option><option value="VALUE:DESC">값 내림차순</option>
                  </select>
                </label>
                <label>열 정렬
                  <select value={colSort ? `${colSort.by ?? 'LABEL'}:${colSort.direction}` : ''} onChange={(event) => {
                    if (!event.target.value) setColSort(undefined);
                    else { const [by, direction] = event.target.value.split(':'); setColSort({ by: by as 'LABEL' | 'VALUE', direction: direction as 'ASC' | 'DESC', ...(by === 'VALUE' && values[0] ? { valueField: values[0].field, aggregation: values[0].aggregation } : {}) }); }
                  }}>
                    <option value="">기본</option><option value="LABEL:ASC">라벨 오름차순</option><option value="LABEL:DESC">라벨 내림차순</option><option value="VALUE:ASC">값 오름차순</option><option value="VALUE:DESC">값 내림차순</option>
                  </select>
                </label>
                <label><input type="checkbox" checked={rowGrandTotals} onChange={(event) => setRowGrandTotals(event.target.checked)} /> 행 총계</label>
                <label><input type="checkbox" checked={columnGrandTotals} onChange={(event) => setColumnGrandTotals(event.target.checked)} /> 열 총계</label>
              </div>
            </div>
          </>}
        </div>
      </div>
      <div className={styles.footer}><button onClick={onClose} className={styles.cancelButton}>닫기</button><button className={styles.createButton} disabled={!sourceRange || values.length === 0 || !validTarget || !name.trim()} onClick={() => sourceRange && onSave({ id: editing?.id, name: name.trim(), targetCell: targetCell.trim(), config: { sourceRange, rows, cols, values, filters, rowSort: normalizeSort(rowSort), colSort: normalizeSort(colSort), rowGrandTotals, columnGrandTotals } })}>{editing ? '변경 저장' : '생성'}</button></div>
    </div>
  </div>;
}
