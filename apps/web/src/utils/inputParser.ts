export interface ParsedInput {
  value: number | string | boolean | null;
  format?: 'general' | 'number' | 'currency' | 'percent' | 'date' | 'time';
}

export function parseInput(input: string): ParsedInput {
    // 1. Check for empty
    if (input === '' || input === null || input === undefined) {
        return { value: null, format: 'general' };
    }

    // 2. Check for Formula (preserved as string, handled by caller generally, but here we just return it as string)
    // Actually caller checks startsWith('='), so this might just be treated as general string if passed.
    if (input.startsWith('=')) {
        return { value: input, format: 'general' };
    }

    const trimmed = input.trim();

    // 3. Percentage: "50%", "12.5%"
    if (trimmed.endsWith('%')) {
        const numPart = trimmed.slice(0, -1);
        if (!isNaN(parseFloat(numPart))) {
            return { value: parseFloat(numPart) / 100, format: 'percent' };
        }
    }

    // 4. Currency: "$100", "$1,000.50", "€50"
    // Regex for basic currency (optional currency symbol, then numbers/commas/dots)
    // Matches $100, $ 100, 100$, 100 $
    // Simple check: start or end with currency symbol?
    if (/^[$€£¥]/.test(trimmed) || /[$€£¥]$/.test(trimmed)) {
        // Remove symbols and commas
        const clean = trimmed.replace(/[$€£¥,]/g, '').trim();
        if (!isNaN(parseFloat(clean))) {
             return { value: parseFloat(clean), format: 'currency' };
        }
    }

    // 5. Time: "12:00", "1:30 PM", "14:00:05"
    // Simple regex: d:dd (AM/PM)?
    // Be careful not to match simple ratios 1:2 if not intended as time?
    // Let's assume colon implies time for now if it parses as date.
    if (trimmed.includes(':') && !trimmed.includes('-') && !trimmed.includes('/')) {
        // Use a dummy date to parse time
        const d = new Date(`1970-01-01 ${trimmed}`);
        if (!isNaN(d.getTime())) {
             return { value: d.getTime(), format: 'time' };
        }
    }

    // 6. Date: "2023-01-01", "1/1/23", "Jan 1, 2023"
    // JS Date parser is flexible.
    // Exclude simple numbers
    if (isNaN(Number(trimmed))) {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
            // Check if it looks like a date?
            // "1.2.3" might parse?
            // "hello" is NaN.
            return { value: date.getTime(), format: 'date' };
        }
    }

    // 7. Boolean
    if (trimmed.toLowerCase() === 'true') return { value: true, format: 'general' };
    if (trimmed.toLowerCase() === 'false') return { value: false, format: 'general' };

    // 8. Number
    // Remove commas for parsing? "1,000" -> 1000
    const cleanNum = trimmed.replace(/,/g, '');
    if (!isNaN(Number(cleanNum)) && trimmed !== '') {
        return { value: Number(cleanNum), format: 'number' };
    }

    // 9. Default: String
    return { value: input, format: 'general' };
}
