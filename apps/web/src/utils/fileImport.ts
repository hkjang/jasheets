/**
 * File Import Utilities for JaSheets
 * Supports: xlsx, xls, csv file parsing and conversion to SheetData format
 */

import * as XLSX from 'xlsx';
import { SheetData, CellData } from '@/types/spreadsheet';

export interface ImportResult {
  data: SheetData;
  sheetName: string;
  sheetNames: string[];
}

/**
 * Parse an XLSX/XLS file and convert to SheetData format
 * @param file - The file to parse
 * @param sheetIndex - Which sheet to parse (default: 0, first sheet)
 */
export async function parseXLSXFile(file: File, sheetIndex: number = 0): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellStyles: true,
          cellDates: true,
        });
        
        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          reject(new Error('No sheets found in file'));
          return;
        }
        
        const targetSheetIndex = Math.min(sheetIndex, sheetNames.length - 1);
        const sheetName = sheetNames[targetSheetIndex];
        const worksheet = workbook.Sheets[sheetName];
        
        const data = workSheetToSheetData(worksheet);
        
        resolve({
          data,
          sheetName,
          sheetNames,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse a CSV file and convert to SheetData format
 * Handles UTF-8 with BOM for Korean text
 */
export async function parseCSVFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        const data = csvTextToSheetData(text);
        
        resolve({
          data,
          sheetName: file.name.replace(/\.csv$/i, ''),
          sheetNames: [file.name.replace(/\.csv$/i, '')],
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Read as UTF-8 text
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Import a spreadsheet file based on its extension
 */
export async function importSpreadsheetFile(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSVFile(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file);
  } else {
    throw new Error(`Unsupported file format: ${fileName}`);
  }
}

/**
 * Convert XLSX worksheet to SheetData format
 */
function workSheetToSheetData(worksheet: XLSX.WorkSheet): SheetData {
  const data: SheetData = {};
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell) {
        if (!data[row]) {
          data[row] = {};
        }
        
        const cellData: CellData = {
          value: cell.v !== undefined ? cell.v : null,
        };
        
        // Preserve formula if present
        if (cell.f) {
          cellData.formula = `=${cell.f}`;
        }
        
        // Basic style extraction
        if (cell.s) {
          cellData.style = extractCellStyle(cell.s);
        }
        
        data[row][col] = cellData;
      }
    }
  }
  
  return data;
}

/**
 * Parse CSV text to SheetData format
 */
function csvTextToSheetData(text: string): SheetData {
  const data: SheetData = {};
  const lines = text.split(/\r\n|\n|\r/);
  
  lines.forEach((line, rowIndex) => {
    if (line.trim() === '') return;
    
    // Parse CSV with proper quote handling
    const values = parseCSVLine(line);
    
    values.forEach((value, colIndex) => {
      if (!data[rowIndex]) {
        data[rowIndex] = {};
      }
      
      // Try to parse as number
      const trimmed = value.trim();
      let parsedValue: string | number | boolean | null = trimmed;
      
      if (trimmed === '') {
        parsedValue = null;
      } else if (trimmed.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (trimmed.toLowerCase() === 'false') {
        parsedValue = false;
      } else {
        const num = Number(trimmed.replace(/,/g, ''));
        if (!isNaN(num) && trimmed !== '') {
          parsedValue = num;
        }
      }
      
      data[rowIndex][colIndex] = { value: parsedValue };
    });
  });
  
  return data;
}

/**
 * Parse a single CSV line with proper quote handling
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Extract basic cell styles from XLSX cell style object
 */
function extractCellStyle(xlsxStyle: any): Record<string, string> {
  const style: Record<string, string> = {};
  
  if (xlsxStyle.font) {
    if (xlsxStyle.font.bold) style.fontWeight = 'bold';
    if (xlsxStyle.font.italic) style.fontStyle = 'italic';
    if (xlsxStyle.font.underline) style.textDecoration = 'underline';
    if (xlsxStyle.font.color?.rgb) {
      style.color = `#${xlsxStyle.font.color.rgb}`;
    }
  }
  
  if (xlsxStyle.fill?.fgColor?.rgb) {
    style.backgroundColor = `#${xlsxStyle.fill.fgColor.rgb}`;
  }
  
  if (xlsxStyle.alignment) {
    if (xlsxStyle.alignment.horizontal) {
      style.textAlign = xlsxStyle.alignment.horizontal;
    }
  }
  
  return style;
}

/**
 * Validate file before import
 */
export function validateImportFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '파일 크기가 10MB를 초과합니다.' };
  }
  
  // Check extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return { valid: false, error: '지원되지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)' };
  }
  
  return { valid: true };
}
