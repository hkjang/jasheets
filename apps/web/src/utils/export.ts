import { SheetData, colIndexToLetter } from '@/types/spreadsheet';

export function exportToCSV(data: SheetData, filename: string = 'spreadsheet.csv') {
    // 1. Determine bounds
    const rows = Object.keys(data).map(Number);
    if (rows.length === 0) return;
    
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    
    let maxCol = 0;
    rows.forEach(r => {
        const cols = Object.keys(data[r]).map(Number);
        if (cols.length > 0) {
            maxCol = Math.max(maxCol, Math.max(...cols));
        }
    });

    // 2. Build Content
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel UTF-8 support

    for (let r = minRow; r <= maxRow; r++) {
        const rowData = [];
        for (let c = 0; c <= maxCol; c++) {
            const cell = data[r]?.[c];
            let value = cell?.value !== undefined && cell?.value !== null ? String(cell.value) : '';
            
            // Escape quotes
            if (value.includes('"') || value.includes(',') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            
            rowData.push(value);
        }
        csvContent += rowData.join(",") + "\r\n";
    }

    // 3. Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
