'use client';

import { useRef, useEffect, useCallback, useState, useMemo, useId } from 'react';
import {
  CellPosition,
  CellRange,
  SheetData,
  ColumnDef,
  RowDef,
  ViewportState,
  SpreadsheetConfig,
  DEFAULT_CONFIG,
  colIndexToLetter,
} from '@/types/spreadsheet';
import { ConditionalRule } from './ConditionalFormattingDialog';
import { resolveConditionalStyle } from '@/utils/conditionalFormatting';
import {
  buildAxisGeometry,
  findAxisIndex,
  getVisibleRange,
} from '@/utils/viewportGeometry';
import styles from './SpreadsheetCanvas.module.css';
import { describeSpreadsheetCell } from '@/utils/spreadsheetAccessibility';

interface SpreadsheetCanvasProps {
  data: SheetData;
  columns: ColumnDef[];
  rows: RowDef[];
  config?: Partial<SpreadsheetConfig>;
  selectedCell: CellPosition | null;
  selection: CellRange | null;
  onCellSelect: (pos: CellPosition) => void;
  onSelectionChange: (range: CellRange) => void;
  onCellEdit: (pos: CellPosition) => void;
  conditionalRules?: ConditionalRule[];
  onColumnResize?: (index: number, width: number) => void;
  onRowResize?: (index: number, height: number) => void;
  onHeaderContextMenu?: (x: number, y: number, type: 'row' | 'col', index: number) => void;
  onCellContextMenu?: (x: number, y: number) => void;
  showGridlines?: boolean;
  isEditing?: boolean;
  onFillRange?: (source: CellRange, target: CellRange) => void;
}

export default function SpreadsheetCanvas({
  data,
  columns,
  rows,
  config: configOverride,
  selectedCell,
  selection,
  onCellSelect,
  onSelectionChange,
  onCellEdit,
  conditionalRules = [],
  onColumnResize,
  onRowResize,
  onHeaderContextMenu,
  onCellContextMenu,
  showGridlines = true,
  isEditing = false,
  onFillRange,
}: SpreadsheetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scrollX: 0,
    scrollY: 0,
    startRow: 0,
    endRow: 50,
    startCol: 0,
    endCol: 20,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const accessibilityId = useId().replace(/:/g, '');
  const activeCellId = `spreadsheet-cell-${accessibilityId}`;
  const activeRowId = `spreadsheet-row-${accessibilityId}`;
  const instructionsId = `spreadsheet-instructions-${accessibilityId}`;

  // Resize State
  const resizingRef = useRef<{ type: 'col' | 'row', index: number, start: number, initialSize: number } | null>(null);
  const fillSourceRef = useRef<CellRange | null>(null);
  const fillTargetRef = useRef<CellRange | null>(null);

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverride }),
    [configOverride]
  );

  const columnGeometry = useMemo(
    () => buildAxisGeometry(
      config.totalCols,
      columns.map((column) => ({ size: column.width, hidden: column.hidden })),
      config.defaultColWidth,
    ),
    [columns, config.defaultColWidth, config.totalCols],
  );
  const rowGeometry = useMemo(
    () => buildAxisGeometry(
      config.totalRows,
      rows.map((row) => ({ size: row.height, hidden: row.hidden })),
      config.defaultRowHeight,
    ),
    [rows, config.defaultRowHeight, config.totalRows],
  );

  // Calculate column positions
  const getColX = useCallback(
    (colIndex: number): number => {
      return config.headerWidth + columnGeometry.offsets[colIndex];
    },
    [columnGeometry, config.headerWidth]
  );

  // Calculate row positions
  const getRowY = useCallback(
    (rowIndex: number): number => {
      return config.headerHeight + rowGeometry.offsets[rowIndex];
    },
    [config.headerHeight, rowGeometry]
  );

  // Get cell position from mouse coordinates
  const getCellFromPoint = useCallback(
    (x: number, y: number): CellPosition | null => {
      const scrollX = viewport.scrollX;
      const scrollY = viewport.scrollY;

      // Check if in header area
      if (x < config.headerWidth || y < config.headerHeight) {
        return null;
      }

      const col = findAxisIndex(columnGeometry, x - config.headerWidth + scrollX);
      const row = findAxisIndex(rowGeometry, y - config.headerHeight + scrollY);

      if (col >= 0 && row >= 0) {
        return { row, col };
      }
      return null;
    },
    [viewport, columnGeometry, rowGeometry, config.headerHeight, config.headerWidth]
  );

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = canvasSize;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    const { scrollX, scrollY } = viewport;

    const { start: startCol, end: endCol } = getVisibleRange(
      columnGeometry,
      scrollX,
      width - config.headerWidth,
    );
    const { start: startRow, end: endRow } = getVisibleRange(
      rowGeometry,
      scrollY,
      height - config.headerHeight,
    );

    // Draw grid lines and cells
    ctx.save();
    ctx.beginPath();
    ctx.rect(config.headerWidth, config.headerHeight, width - config.headerWidth, height - config.headerHeight);
    ctx.clip();

    // Draw cells
    let currentY = getRowY(startRow) - scrollY;
    for (let row = startRow; row <= endRow; row++) {
      if (rows[row]?.hidden) continue;
      const rowHeight = rows[row]?.height ?? config.defaultRowHeight;

      let currentX = getColX(startCol) - scrollX;
      for (let col = startCol; col <= endCol; col++) {
        if (columns[col]?.hidden) continue;
        const colWidth = columns[col]?.width ?? config.defaultColWidth;
        const cellData = data[row]?.[col];

        // Check if cell is in selection
        const isInSelection =
          selection &&
          row >= selection.start.row &&
          row <= selection.end.row &&
          col >= selection.start.col &&
          col <= selection.end.col;

        const isSelected =
          selectedCell && selectedCell.row === row && selectedCell.col === col;

        // Draw cell background
        if (isInSelection && !isSelected) {
          ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';
          ctx.fillRect(currentX, currentY, colWidth, rowHeight);
        }

        // Apply cell style background
        if (cellData?.style?.backgroundColor) {
          ctx.fillStyle = cellData.style.backgroundColor;
          ctx.fillRect(currentX, currentY, colWidth, rowHeight);
        }

        // Apply conditional formatting
        const conditionalStyle = resolveConditionalStyle(conditionalRules, row, col, cellData?.value ?? null);

        // Apply conditional background if present
        if (conditionalStyle.backgroundColor) {
          ctx.fillStyle = conditionalStyle.backgroundColor;
          ctx.fillRect(currentX, currentY, colWidth, rowHeight);
        }

        // Draw cell border
        if (showGridlines) {
          ctx.strokeStyle = '#e2e2e2';
          ctx.lineWidth = 1;
          ctx.strokeRect(currentX + 0.5, currentY + 0.5, colWidth, rowHeight);
        }

        // Draw cell content
        if (cellData) {
          const displayValue = cellData.error || cellData.displayValue || String(cellData.value ?? '');

          ctx.fillStyle = conditionalStyle.color || (cellData.error ? '#ea4335' : (cellData.style?.color || '#202124'));

          const fontWeight = conditionalStyle.fontWeight || cellData.style?.fontWeight;
          const fontStyle = conditionalStyle.fontStyle || cellData.style?.fontStyle;

          ctx.font = `${fontWeight === 'bold' ? 'bold ' : ''}${fontStyle === 'italic' ? 'italic ' : ''}${cellData.style?.fontSize || 13}px ${cellData.style?.fontFamily || 'Arial'}`;

          const textX = cellData.style?.textAlign === 'center'
            ? currentX + colWidth / 2
            : cellData.style?.textAlign === 'right'
              ? currentX + colWidth - 4
              : currentX + 4;

          ctx.textAlign = (cellData.style?.textAlign as CanvasTextAlign) || 'left';
          ctx.textBaseline = 'middle';

          // Clip text to cell bounds
          ctx.save();
          ctx.beginPath();
          ctx.rect(currentX + 2, currentY + 2, colWidth - 4, rowHeight - 4);
          ctx.clip();
          ctx.fillText(displayValue, textX, currentY + rowHeight / 2);
          ctx.restore();
        }

        currentX += colWidth;
      }
      currentY += rowHeight;
    }

    // Draw selected cell border (skip when editing - CellEditor shows its own border)
    if (!isEditing && selectedCell && selectedCell.row >= startRow && selectedCell.row <= endRow && selectedCell.col >= startCol && selectedCell.col <= endCol) {
      const cellX = getColX(selectedCell.col) - scrollX;
      const cellY = getRowY(selectedCell.row) - scrollY;
      const cellWidth = columns[selectedCell.col]?.width ?? config.defaultColWidth;
      const cellHeight = rows[selectedCell.row]?.height ?? config.defaultRowHeight;

      ctx.strokeStyle = '#1a73e8';
      ctx.lineWidth = 2;
      ctx.strokeRect(cellX + 1, cellY + 1, cellWidth - 2, cellHeight - 2);

      // Draw selection handle
      ctx.fillStyle = '#1a73e8';
      ctx.fillRect(cellX + cellWidth - 5, cellY + cellHeight - 5, 6, 6);
    }

    // Draw selection border
    if (selection && !(selection.start.row === selection.end.row && selection.start.col === selection.end.col)) {
      const selStartX = getColX(selection.start.col) - scrollX;
      const selStartY = getRowY(selection.start.row) - scrollY;
      let selWidth = 0;
      let selHeight = 0;

      for (let c = selection.start.col; c <= selection.end.col; c++) {
        selWidth += columns[c]?.width ?? config.defaultColWidth;
      }
      for (let r = selection.start.row; r <= selection.end.row; r++) {
        selHeight += rows[r]?.height ?? config.defaultRowHeight;
      }

      ctx.strokeStyle = '#1a73e8';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(selStartX + 0.5, selStartY + 0.5, selWidth, selHeight);
      ctx.fillStyle = '#1a73e8';
      ctx.fillRect(selStartX + selWidth - 5, selStartY + selHeight - 5, 6, 6);
    }

    ctx.restore();

    // Draw column headers
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(config.headerWidth, 0, width - config.headerWidth, config.headerHeight);
    ctx.fillRect(0, 0, config.headerWidth, height);

    // Column labels
    for (let col = startCol; col <= endCol; col++) {
      if (columns[col]?.hidden) continue;
      const colX = getColX(col) - scrollX;
      const colWidth = columns[col]?.width ?? config.defaultColWidth;

      const isColSelected = selection && col >= selection.start.col && col <= selection.end.col;

      if (isColSelected) {
        ctx.fillStyle = '#e8f0fe';
        ctx.fillRect(colX, 0, colWidth, config.headerHeight);
      }

      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(colX + 0.5, 0.5, colWidth, config.headerHeight);

      ctx.fillStyle = isColSelected ? '#1a73e8' : '#5f6368';
      ctx.font = '500 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colIndexToLetter(col), colX + colWidth / 2, config.headerHeight / 2);
    }

    // Row labels
    for (let row = startRow; row <= endRow; row++) {
      if (rows[row]?.hidden) continue;
      const rowY = getRowY(row) - scrollY;
      const rowHeight = rows[row]?.height ?? config.defaultRowHeight;

      const isRowSelected = selection && row >= selection.start.row && row <= selection.end.row;

      if (isRowSelected) {
        ctx.fillStyle = '#e8f0fe';
        ctx.fillRect(0, rowY, config.headerWidth, rowHeight);
      }

      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, rowY + 0.5, config.headerWidth, rowHeight);

      ctx.fillStyle = isRowSelected ? '#1a73e8' : '#5f6368';
      ctx.font = '500 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(row + 1), config.headerWidth / 2, rowY + rowHeight / 2);
    }

    // Top-left corner
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, config.headerWidth, config.headerHeight);
    ctx.strokeStyle = '#e0e0e0';
    ctx.strokeRect(0.5, 0.5, config.headerWidth, config.headerHeight);
  }, [
    canvasSize,
    viewport,
    data,
    columns,
    rows,
    config,
    selectedCell,
    selection,
    conditionalRules,
    getColX,
    getRowY,
    showGridlines,
    isEditing,
    columnGeometry,
    rowGeometry,
  ]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Redraw on state change
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setViewport((prev) => ({
      ...prev,
      scrollX: target.scrollLeft,
      scrollY: target.scrollTop,
    }));
  }, []);

  // Keep keyboard navigation visible without requiring pointer-based scrolling.
  useEffect(() => {
    const container = containerRef.current?.querySelector<HTMLElement>(`.${styles.scrollContainer}`);
    if (!container || !selectedCell) return;
    const left = columnGeometry.offsets[selectedCell.col];
    const right = left + columnGeometry.sizes[selectedCell.col];
    const top = rowGeometry.offsets[selectedCell.row];
    const bottom = top + rowGeometry.sizes[selectedCell.row];
    const visibleWidth = container.clientWidth - config.headerWidth;
    const visibleHeight = container.clientHeight - config.headerHeight;

    if (left < container.scrollLeft) container.scrollLeft = left;
    else if (right > container.scrollLeft + visibleWidth) container.scrollLeft = right - visibleWidth;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (bottom > container.scrollTop + visibleHeight) container.scrollTop = bottom - visibleHeight;
  }, [columnGeometry, config.headerHeight, config.headerWidth, rowGeometry, selectedCell]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.button === 0 && selection) {
        const handleX = getColX(selection.end.col) - viewport.scrollX + (columns[selection.end.col]?.width ?? config.defaultColWidth);
        const handleY = getRowY(selection.end.row) - viewport.scrollY + (rows[selection.end.row]?.height ?? config.defaultRowHeight);
        if (Math.abs(x - handleX) <= 7 && Math.abs(y - handleY) <= 7) {
          fillSourceRef.current = selection;
          fillTargetRef.current = selection;
          return;
        }
      }

      // Check for structural resize (Headers)
      if (y < config.headerHeight && x > config.headerWidth) {
        // Check Col Resize
        let currentX = config.headerWidth - viewport.scrollX;
        for (let i = 0; i < config.totalCols; i++) {
          const width = columns[i]?.width ?? config.defaultColWidth;
          if (Math.abs(x - (currentX + width)) < 5) {
            resizingRef.current = { type: 'col', index: i, start: e.clientX, initialSize: width };
            return;
          }
          currentX += width;
          if (currentX > canvasSize.width) break;
        }
      } else if (x < config.headerWidth && y < config.headerHeight) {
        // Corner - do nothing for now
      } else if (x < config.headerWidth && y > config.headerHeight) {
        // Check Row Resize
        let currentY = config.headerHeight - viewport.scrollY;
        for (let i = 0; i < config.totalRows; i++) {
          const height = rows[i]?.height ?? config.defaultRowHeight;
          if (Math.abs(y - (currentY + height)) < 5) {
            resizingRef.current = { type: 'row', index: i, start: e.clientY, initialSize: height };
            return;
          }
          currentY += height;
          if (currentY > canvasSize.height) break;
        }
      }

      const cell = getCellFromPoint(x, y);
      if (cell) {
        // Right-click: preserve selection if clicked cell is within current selection
        if (e.button === 2 && selection) {
          const isWithinSelection =
            cell.row >= selection.start.row &&
            cell.row <= selection.end.row &&
            cell.col >= selection.start.col &&
            cell.col <= selection.end.col;
          if (isWithinSelection) {
            // Don't change selection, just return to let context menu handle it
            return;
          }
        }

        // Left-click or right-click outside selection: start new selection
        setIsSelecting(true);
        setSelectionStart(cell);
        onCellSelect(cell);
        onSelectionChange({ start: cell, end: cell });
      } else if (y < config.headerHeight && x > config.headerWidth) {
        // Click on Col Header -> Select Col
        let col = -1;
        let currentX = config.headerWidth - viewport.scrollX;
        for (let i = 0; i < config.totalCols; i++) {
          const width = columns[i]?.width ?? config.defaultColWidth;
          if (x >= currentX && x < currentX + width) {
            col = i;
            break;
          }
          currentX += width;
        }
        if (col >= 0) {
          // Select whole column logic? For now selecting first 1000 rows
          const range = { start: { row: 0, col }, end: { row: config.totalRows - 1, col } };
          onSelectionChange(range);
          onCellSelect({ row: 0, col });
        }
      } else if (x < config.headerWidth && y > config.headerHeight) {
        // Click on Row Header -> Select Row
        let row = -1;
        let currentY = config.headerHeight - viewport.scrollY;
        for (let i = 0; i < config.totalRows; i++) {
          const height = rows[i]?.height ?? config.defaultRowHeight;
          if (y >= currentY && y < currentY + height) {
            row = i;
            break;
          }
          currentY += height;
        }
        if (row >= 0) {
          const range = { start: { row, col: 0 }, end: { row, col: config.totalCols - 1 } };
          onSelectionChange(range);
          onCellSelect({ row, col: 0 });
        }
      }
    },
    [getCellFromPoint, getColX, getRowY, onCellSelect, onSelectionChange, config, columns, rows, viewport, canvasSize, selection]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (fillSourceRef.current) {
        const cell = getCellFromPoint(x, y);
        if (cell) {
          const source = fillSourceRef.current;
          const target = {
            start: source.start,
            end: { row: Math.max(source.end.row, cell.row), col: Math.max(source.end.col, cell.col) },
          };
          fillTargetRef.current = target;
          onSelectionChange(target);
        }
        canvas.style.cursor = 'crosshair';
        return;
      }

      // Handle Resize
      if (resizingRef.current) {
        const { type, index, start, initialSize } = resizingRef.current;
        if (type === 'col') {
          const diff = e.clientX - start;
          const newWidth = Math.max(config.minColWidth, initialSize + diff);
          onColumnResize?.(index, newWidth);
        } else {
          const diff = e.clientY - start;
          const newHeight = Math.max(config.minRowHeight, initialSize + diff);
          onRowResize?.(index, newHeight);
        }
        return;
      }

      // Cursor logic
      let cursor = 'default';
      if (y < config.headerHeight && x > config.headerWidth) {
        let currentX = config.headerWidth - viewport.scrollX;
        for (let i = 0; i < config.totalCols; i++) {
          const width = columns[i]?.width ?? config.defaultColWidth;
          if (Math.abs(x - (currentX + width)) < 5) {
            cursor = 'col-resize';
            break;
          }
          currentX += width;
          if (currentX > canvasSize.width) break;
        }
        if (cursor === 'default') cursor = 's-resize'; // Click to select column pointer? 's-resize' looks weird. 'pointer' or 's-resize' is for row resize... 'chevron-down'?
        // Actually standard is down arrow for selection, or col-resize for edge.
        // Let's use 'pointer' for header selection for now
        if (cursor === 'default') cursor = 'pointer';
      } else if (x < config.headerWidth && y > config.headerHeight) {
        let currentY = config.headerHeight - viewport.scrollY;
        for (let i = 0; i < config.totalRows; i++) {
          const height = rows[i]?.height ?? config.defaultRowHeight;
          if (Math.abs(y - (currentY + height)) < 5) {
            cursor = 'row-resize';
            break;
          }
          currentY += height;
          if (currentY > canvasSize.height) break;
        }
        if (cursor === 'default') cursor = 'pointer';
      } else if (x > config.headerWidth && y > config.headerHeight) {
        cursor = 'cell';
      }
      canvas.style.cursor = cursor;

      if (!isSelecting || !selectionStart) return;

      const cell = getCellFromPoint(x, y);
      if (cell) {
        onSelectionChange({ start: selectionStart, end: cell });
      }
    },
    [
      canvasSize,
      columns,
      config,
      getCellFromPoint,
      isSelecting,
      onColumnResize,
      onRowResize,
      onSelectionChange,
      rows,
      selectionStart,
      viewport,
    ]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (fillSourceRef.current && fillTargetRef.current) {
      onFillRange?.(fillSourceRef.current, fillTargetRef.current);
    }
    fillSourceRef.current = null;
    fillTargetRef.current = null;
    setIsSelecting(false);
    setSelectionStart(null);
    resizingRef.current = null;
  }, [onFillRange]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y < config.headerHeight && x > config.headerWidth) {
      // Col Header
      if (!onHeaderContextMenu) return;
      let currentX = config.headerWidth - viewport.scrollX;
      for (let i = 0; i < config.totalCols; i++) {
        const width = columns[i]?.width ?? config.defaultColWidth;
        if (x >= currentX && x < currentX + width) {
          onHeaderContextMenu(e.clientX, e.clientY, 'col', i);
          return;
        }
        currentX += width;
      }
    } else if (x < config.headerWidth && y > config.headerHeight) {
      // Row Header
      if (!onHeaderContextMenu) return;
      let currentY = config.headerHeight - viewport.scrollY;
      for (let i = 0; i < config.totalRows; i++) {
        const height = rows[i]?.height ?? config.defaultRowHeight;
        if (y >= currentY && y < currentY + height) {
          onHeaderContextMenu(e.clientX, e.clientY, 'row', i);
          return;
        }
        currentY += height;
      }
    } else if (x > config.headerWidth && y > config.headerHeight) {
      // Cell area - trigger cell context menu
      onCellContextMenu?.(e.clientX, e.clientY);
    }
  }, [config, viewport, onHeaderContextMenu, onCellContextMenu, columns, rows]);

  // Handle double click for editing
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = getCellFromPoint(x, y);
      if (cell) {
        onCellEdit(cell);
      }
    },
    [getCellFromPoint, onCellEdit]
  );

  // Calculate total content size for scrolling
  const totalWidth = config.headerWidth + columnGeometry.totalSize;
  const totalHeight = config.headerHeight + rowGeometry.totalSize;
  const cellDescription = useMemo(
    () => describeSpreadsheetCell(data, selectedCell, selection),
    [data, selectedCell, selection],
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <div
        className={styles.scrollContainer}
        onScroll={handleScroll}
      >
        <div
          className={styles.scrollContent}
          style={{ width: totalWidth, height: totalHeight }}
        />
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="Spreadsheet grid"
          aria-describedby={instructionsId}
          aria-activedescendant={selectedCell ? activeCellId : undefined}
          aria-owns={selectedCell ? activeRowId : undefined}
          aria-rowcount={config.totalRows}
          aria-colcount={config.totalCols}
          role="grid"
          className={styles.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        />
        <div id={instructionsId} className={styles.srOnly}>
          Use arrow keys to move between cells, Shift plus arrow keys to select a range,
          Enter to move down, and type to edit the selected cell.
        </div>
        {selectedCell && (
          <div id={activeRowId} role="row" className={styles.srOnly}>
            <div
              id={activeCellId}
              role="gridcell"
              aria-rowindex={selectedCell.row + 1}
              aria-colindex={selectedCell.col + 1}
              aria-selected="true"
            >
              {cellDescription}
            </div>
          </div>
        )}
        <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {cellDescription}
        </div>
      </div>
    </div>
  );
}
