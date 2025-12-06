export type FormatType = 'general' | 'number' | 'currency' | 'percent' | 'date' | 'time';

export function formatValue(value: string | number | boolean | null, format: string): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    
    // If it's a string, we usually just return it, BUT user might have switched format to 'date' 
    // on a cell that currently holds a string like "2023-01-01".
    // ideally the value should have been converted to number (timestamp) on storage.
    // If we still have a string, try to parse it if format implies we should?
    // For now, let's just try to parse if it's a number-like string and format is specific.
    
    let num = typeof value === 'string' ? parseFloat(value) : value;

    // Special handling for Date/Time where value might be a timestamp number
    if ((format === 'date' || format === 'time') && typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        
        if (format === 'date') return date.toLocaleDateString();
        if (format === 'time') return date.toLocaleTimeString();
    }

    if (isNaN(num)) {
        // Fallback for non-numeric values
        return String(value);
    }

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
        case 'percent':
            // 0.1 -> 10.00%
            return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }).format(num);
        case 'number':
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
        case 'date':
             // If we got here, num is a number but wasn't caught above? or it was a string parsed to float.
             // If simple number like 2023, treating as date is weird (epoch).
             // Let's assume if it's a small number, maybe excel serial? (Not implementing that yet)
             // If large number, timestamp.
             try {
                 const date = new Date(num); 
                 if (isNaN(date.getTime())) return String(value);
                 return date.toLocaleDateString();
             } catch { return String(value); }
        case 'time':
             try {
                 const date = new Date(num);
                 if (isNaN(date.getTime())) return String(value);
                 return date.toLocaleTimeString();
             } catch { return String(value); }
        case 'general':
        default:
            return String(value);
    }
}
