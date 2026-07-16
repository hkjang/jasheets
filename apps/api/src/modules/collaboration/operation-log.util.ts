export interface LoggedOperation {
  sequence: number;
  event: string;
  payload: any;
}

export interface SnapshotCell {
  row: number;
  col: number;
  value: unknown;
  formula?: string;
}

export function reduceOperationLog(
  operations: LoggedOperation[],
  initialCells: SnapshotCell[] = [],
): SnapshotCell[] {
  const cells = new Map(initialCells.map((cell) => [`${cell.row}:${cell.col}`, { ...cell }]));
  [...operations].sort((a, b) => a.sequence - b.sequence).forEach((operation) => {
    const payload = operation.payload;
    const updates = operation.event === 'cell-updated'
      ? [payload]
      : operation.event === 'cells-updated'
        ? payload.updates ?? []
        : [];
    updates.forEach((update: any) => {
      cells.set(`${update.row}:${update.col}`, {
        row: update.row,
        col: update.col,
        value: update.value,
        formula: update.formula,
      });
    });
  });
  return [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}
