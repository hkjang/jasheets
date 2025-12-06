'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  CellPosition,
  CellRange,
  CellData,
  SheetData,
  ColumnDef,
  RowDef,
  ViewportState,
  SpreadsheetConfig,
  DEFAULT_CONFIG,
  colIndexToLetter,
  parseSelection,
} from '@/types/spreadsheet';
import { ConditionalRule } from './ConditionalFormattingDialog';
import styles from './SpreadsheetCanvas.module.css';

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

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverride }),
    [configOverride]
  );

  // Calculate column positions
  const getColX = useCallback(
    (colIndex: number): number => {
      let x = config.headerWidth;
      for (let i = 0; i < colIndex; i++) {
        x += columns[i]?.width ?? config.defaultColWidth;
      }
      return x;
    },
    [columns, config]
  );

  // Calculate row positions
  const getRowY = useCallback(
    (rowIndex: number): number => {
      let y = config.headerHeight;
      for (let i = 0; i < rowIndex; i++) {
        y += rows[i]?.height ?? config.defaultRowHeight;
      }
      return y;
    },
    [rows, config]
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

      // Find column
      let col = -1;
      let currentX = config.headerWidth - scrollX;
      for (let i = 0; i < config.totalCols; i++) {
        const colWidth = columns[i]?.width ?? config.defaultColWidth;
        if (x >= currentX && x < currentX + colWidth) {
          col = i;
          break;
        }
        currentX += colWidth;
      }

      // Find row
      let row = -1;
      let currentY = config.headerHeight - scrollY;
      for (let i = 0; i < config.totalRows; i++) {
        const rowHeight = rows[i]?.height ?? config.defaultRowHeight;
        if (y >= currentY && y < currentY + rowHeight) {
          row = i;
          break;
        }
        currentY += rowHeight;
      }

      if (col >= 0 && row >= 0) {
        return { row, col };
      }
      return null;
    },
    [viewport, columns, rows, config]
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

    // Calculate visible range
    let startCol = 0;
    let endCol = 0;
    let x = config.headerWidth - scrollX;
    for (let i = 0; i < config.totalCols; i++) {
      const colWidth = columns[i]?.width ?? config.defaultColWidth;
      if (x + colWidth > config.headerWidth) {
        if (startCol === 0 && x < config.headerWidth) startCol = i;
        endCol = i;
      }
      x += colWidth;
      if (x > width) break;
    }

    let startRow = 0;
    let endRow = 0;
    let y = config.headerHeight - scrollY;
    for (let i = 0; i < config.totalRows; i++) {
      const rowHeight = rows[i]?.height ?? config.defaultRowHeight;
      if (y + rowHeight > config.headerHeight) {
        if (startRow === 0 && y < config.headerHeight) startRow = i;
        endRow = i;
      }
      y += rowHeight;
      if (y > height) break;
    }

    // Draw grid lines and cells
    ctx.save();
    ctx.beginPath();
    ctx.rect(config.headerWidth, config.headerHeight, width - config.headerWidth, height - config.headerHeight);
    ctx.clip();

    // Draw cells
    for (let row = startRow; row <= endRow; row++) {
      const rowY = getRowY(row) - scrollY;
      const rowHeight = rows[row]?.height ?? config.defaultRowHeight;

      for (let col = startCol; col <= endCol; col++) {
        const colX = getColX(col) - scrollX;
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
          ctx.fillRect(colX, rowY, colWidth, rowHeight);
        }

        // Apply cell style background
        if (cellData?.style?.backgroundColor) {
          ctx.fillStyle = cellData.style.backgroundColor;
          ctx.fillRect(colX, rowY, colWidth, rowHeight);
        }

        // Apply conditional formatting
        let conditionalStyle = {};
        for (const rule of conditionalRules) {
             const isInRuleRange = 
               row >= rule.range.startRow && 
               row <= rule.range.endRow && 
               col >= rule.range.startCol && 
               col <= rule.range.endCol;
             
             if (isInRuleRange) {
               const value = cellData?.value;
               const cellValue = typeof value === 'number' ? value : String(value ?? '');
               const ruleValue = parseFloat(rule.value);
               const ruleValue2 = parseFloat(rule.value2 || '0');
               
               let match = false;
               
               if (rule.type === 'greaterThan' && typeof cellValue === 'number') {
                 match = cellValue > ruleValue;
               } else if (rule.type === 'lessThan' && typeof cellValue === 'number') {
                 match = cellValue < ruleValue;
               } else if (rule.type === 'equalTo') {
                 // eslint-disable-next-line eqeqeq
                 match = cellValue == rule.value;
               } else if (rule.type === 'contains') {
                 match = String(cellValue).includes(rule.value);
               } else if (rule.type === 'between' && typeof cellValue === 'number') {
                 match = cellValue >= ruleValue && cellValue <= ruleValue2;
               }
               
               if (match) {
                 conditionalStyle = { ...conditionalStyle, ...rule.style };
               }
             }
        }
        
        // Apply conditional background if present
        // @ts-ignore
        if (conditionalStyle.backgroundColor) {
             // @ts-ignore
             ctx.fillStyle = conditionalStyle.backgroundColor;
             ctx.fillRect(colX, rowY, colWidth, rowHeight);
        }

        // Draw cell border
        ctx.strokeStyle = '#e2e2e2';
        ctx.lineWidth = 1;
        ctx.strokeRect(colX + 0.5, rowY + 0.5, colWidth, rowHeight);

        // Draw cell content
        if (cellData) {
          const displayValue = cellData.error || cellData.displayValue || String(cellData.value ?? '');
          
          // @ts-ignore
          ctx.fillStyle = conditionalStyle.color || (cellData.error ? '#ea4335' : (cellData.style?.color || '#202124'));
          
          // @ts-ignore
          const fontWeight = conditionalStyle.fontWeight || cellData.style?.fontWeight;
          // @ts-ignore
          const fontStyle = conditionalStyle.fontStyle || cellData.style?.fontStyle;
          
          ctx.font = `${fontWeight === 'bold' ? 'bold ' : ''}${fontStyle === 'italic' ? 'italic ' : ''}${cellData.style?.fontSize || 13}px ${cellData.style?.fontFamily || 'Arial'}`;
          
          const textX = cellData.style?.textAlign === 'center' 
            ? colX + colWidth / 2 
            : cellData.style?.textAlign === 'right'
              ? colX + colWidth - 4
              : colX + 4;
          
          ctx.textAlign = (cellData.style?.textAlign as CanvasTextAlign) || 'left';
          ctx.textBaseline = 'middle';
          
          // Clip text to cell bounds
          ctx.save();
          ctx.beginPath();
          ctx.rect(colX + 2, rowY + 2, colWidth - 4, rowHeight - 4);
          ctx.clip();
          ctx.fillText(displayValue, textX, rowY + rowHeight / 2);
          ctx.restore();
        }
      }
    }

    // Draw selected cell border
    if (selectedCell && selectedCell.row >= startRow && selectedCell.row <= endRow && selectedCell.col >= startCol && selectedCell.col <= endCol) {
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
    }

    ctx.restore();

    // Draw column headers
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(config.headerWidth, 0, width - config.headerWidth, config.headerHeight);
    ctx.fillRect(0, 0, config.headerWidth, height);

    // Column labels
    for (let col = startCol; col <= endCol; col++) {
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

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = getCellFromPoint(x, y);
      if (cell) {
        setIsSelecting(true);
        setSelectionStart(cell);
        onCellSelect(cell);
        onSelectionChange({ start: cell, end: cell });
      }
    },
    [getCellFromPoint, onCellSelect, onSelectionChange]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isSelecting || !selectionStart) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = getCellFromPoint(x, y);
      if (cell) {
        onSelectionChange(parseSelection(selectionStart, cell));
      }
    },
    [isSelecting, selectionStart, getCellFromPoint, onSelectionChange]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    setSelectionStart(null);
  }, []);

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
  const totalWidth = useMemo(() => {
    let width = config.headerWidth;
    for (let i = 0; i < config.totalCols; i++) {
      width += columns[i]?.width ?? config.defaultColWidth;
    }
    return width;
  }, [columns, config]);

  const totalHeight = useMemo(() => {
    let height = config.headerHeight;
    for (let i = 0; i < config.totalRows; i++) {
      height += rows[i]?.height ?? config.defaultRowHeight;
    }
    return height;
  }, [rows, config]);

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
          className={styles.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>
    </div>
  );
}
