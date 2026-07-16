import { CellPosition, ProtectedRange } from '@/types/spreadsheet';

export function containsCell(protectedRange: ProtectedRange, cell: CellPosition): boolean {
  const { start, end } = protectedRange.range;
  return cell.row >= Math.min(start.row, end.row)
    && cell.row <= Math.max(start.row, end.row)
    && cell.col >= Math.min(start.col, end.col)
    && cell.col <= Math.max(start.col, end.col);
}

export function canEditCell(
  protectedRanges: ProtectedRange[],
  cell: CellPosition,
  userId?: string,
): boolean {
  return protectedRanges.every((protectedRange) => {
    if (!containsCell(protectedRange, cell)) return true;
    if (!userId) return false;
    return protectedRange.ownerId === userId || protectedRange.allowedUserIds.includes(userId);
  });
}
