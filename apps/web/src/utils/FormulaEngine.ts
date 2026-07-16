import { NamedRanges, SheetData } from '@/types/spreadsheet';
import { datePartsToSerial, dateToSerial, serialToDate, timePartsToSerial } from './dateSerial';

/**
 * Basic Formula Engine for JaSheets
 * Supports:
 * - Arithmetic: +, -, *, /, (, )
 * - Functions: SUM, AVERAGE, MIN, MAX, COUNT
 * - References: A1, B2, A1:B2 (Ranges)
 */

export type TokenType = 'NUMBER' | 'STRING' | 'REF' | 'RANGE' | 'NAME' | 'FUNCTION' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = ['+', '-', '*', '/'];
const FUNCTIONS = [
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'SEQUENCE',
  'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'TODAY', 'NOW',
];

export type FormulaResult = string | number | number[][];

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Remove leading =
  if (formula.startsWith('=')) i++;

  while (i < formula.length) {
    const char = formula[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let num = '';
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    if (OPERATORS.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    if (/[A-Za-z$]/.test(char)) {
      let word = '';
      while (i < formula.length && /[A-Za-z0-9:$]/.test(formula[i])) { // Include : and $ for ranges/references
        word += formula[i];
        i++;
      }
      
      const upper = word.toUpperCase();
      if (FUNCTIONS.includes(upper)) {
        tokens.push({ type: 'FUNCTION', value: upper });
      } else if (/^\$?[A-Z]+\$?[1-9][0-9]*:\$?[A-Z]+\$?[1-9][0-9]*$/.test(upper)) {
         tokens.push({ type: 'RANGE', value: upper }); // A1:B2
      } else if (/^\$?[A-Z]+\$?[1-9][0-9]*$/.test(upper)) {
         tokens.push({ type: 'REF', value: upper }); // A1
      } else {
         tokens.push({ type: 'NAME', value: upper });
      }
      continue;
    }
    
    // Fallback?
    i++;
  }
  
  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// Convert A1 to row/col
function parseCellRef(ref: string): { row: number, col: number } | null {
    const match = ref.match(/^\$?([A-Z]+)\$?([0-9]+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { row: parseInt(rowStr) - 1, col: col - 1 };
}

function columnNameToIndex(name: string): number {
    let index = 0;
    for (const char of name) {
        index = index * 26 + (char.charCodeAt(0) - 64);
    }
    return index - 1;
}

function columnIndexToName(index: number): string {
    let name = '';
    let value = index + 1;
    while (value > 0) {
        const remainder = (value - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        value = Math.floor((value - 1) / 26);
    }
    return name;
}

/**
 * Moves relative parts of A1 references when a formula is copied to another
 * cell. Absolute row/column anchors remain fixed and references inside quoted
 * strings are left untouched.
 */
export function shiftFormulaReferences(formula: string, rowOffset: number, colOffset: number): string {
    let result = '';
    let segmentStart = 0;
    let quote: string | null = null;

    const shiftSegment = (segment: string) => segment.replace(
        /(^|[^A-Z0-9_])((\$?)([A-Z]+)(\$?)([1-9][0-9]*))(?![A-Z0-9_])/gi,
        (_match, prefix: string, _reference: string, colAnchor: string, colName: string, rowAnchor: string, rowNumber: string) => {
            const col = columnNameToIndex(colName.toUpperCase()) + (colAnchor ? 0 : colOffset);
            const row = Number(rowNumber) - 1 + (rowAnchor ? 0 : rowOffset);
            if (col < 0 || row < 0) return `${prefix}#REF!`;
            return `${prefix}${colAnchor}${columnIndexToName(col)}${rowAnchor}${row + 1}`;
        },
    );

    for (let i = 0; i < formula.length; i++) {
        const char = formula[i];
        if (!quote && (char === '"' || char === "'")) {
            result += shiftSegment(formula.slice(segmentStart, i));
            quote = char;
            segmentStart = i;
        } else if (quote && char === quote && formula[i - 1] !== '\\') {
            result += formula.slice(segmentStart, i + 1);
            quote = null;
            segmentStart = i + 1;
        }
    }

    const tail = formula.slice(segmentStart);
    return result + (quote ? tail : shiftSegment(tail));
}

function getRangeValues(range: string, data: SheetData): number[] {
    const parts = range.split(':');
    if (parts.length !== 2) return [];
    
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    
    if (!start || !end) return [];
    
    const values: number[] = [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const val = data[r]?.[c]?.value;
            const num = parseFloat(String(val));
            if (!isNaN(num)) values.push(num);
        }
    }
    return values;
}

export function evaluateFormula(formula: string, data: SheetData, namedRanges: NamedRanges = {}): FormulaResult {
    try {
        if (!formula.startsWith('=')) return formula;

        const sequence = formula.match(/^=SEQUENCE\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?(?:,\s*(-?\d+(?:\.\d+)?)\s*)?(?:,\s*(-?\d+(?:\.\d+)?)\s*)?\)$/i);
        if (sequence) {
            const rows = Number(sequence[1]);
            const cols = Number(sequence[2] ?? 1);
            const start = Number(sequence[3] ?? 1);
            const step = Number(sequence[4] ?? 1);
            if (rows < 1 || cols < 1 || rows * cols > 10000) return '#NUM!';
            return Array.from({ length: rows }, (_, row) =>
                Array.from({ length: cols }, (_, col) => start + (row * cols + col) * step),
            );
        }

        const arrayLiteral = formula.match(/^=\{(.+)\}$/);
        if (arrayLiteral) {
            const rows = arrayLiteral[1].split(';').map((row) =>
                row.split(',').map((value) => Number(value.trim())),
            );
            if (rows.some((row) => row.length !== rows[0].length || row.some(Number.isNaN))) return '#VALUE!';
            return rows;
        }
        
        const tokens = tokenize(formula);
        let pos = 0;
        
        function peek(): Token {
            return tokens[pos];
        }
        
        function consume(): Token {
            return tokens[pos++];
        }

        // --- Parser (Recursive Descent) ---
        // Expression = Term { (+|-) Term }
        // Term = Factor { (*|/) Factor }
        // Factor = Number | Ref | ( Expression ) | Function
        
        function parseExpression(): number {
            let left = parseTerm();
            
            while (peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
                const op = consume().value;
                const right = parseTerm();
                if (op === '+') left += right;
                else left -= right;
            }
            return left;
        }
        
        function parseTerm(): number {
            let left = parseFactor();
            while (peek().type === 'OPERATOR' && (peek().value === '*' || peek().value === '/')) {
                 const op = consume().value;
                 const right = parseFactor();
                 if (op === '*') left *= right;
                 else left /= right;
            }
            return left;
        }
        
        function parseFactor(): number {
            const token = peek();
            
            if (token.type === 'NUMBER') {
                consume();
                return parseFloat(token.value);
            }
            
            if (token.type === 'REF') {
                consume();
                const coords = parseCellRef(token.value);
                if (!coords) return 0;
                
                const val = data[coords.row]?.[coords.col]?.value;
                const num = parseFloat(String(val));
                return isNaN(num) ? 0 : num;
            }

            if (token.type === 'NAME') {
                consume();
                const range = namedRanges[token.value];
                if (!range) return 0;
                const val = data[range.start.row]?.[range.start.col]?.value;
                const num = parseFloat(String(val));
                return isNaN(num) ? 0 : num;
            }
            
            if (token.type === 'LPAREN') {
                consume();
                const val = parseExpression();
                if (peek().type === 'RPAREN') consume();
                return val;
            }
            
            if (token.type === 'FUNCTION') {
                 return parseFunction();
            }
            
            // Unexpected
            consume();
            return 0;
        }
        
        function parseFunction(): number {
             const funcName = consume().value; // SUM, AVERAGE...
             if (peek().type !== 'LPAREN') return 0;
             consume(); // (
             
             // Gather arguments (supports Numbers, Ranges, Refs, Expressions)
             // Simplified: Just supports Ranges or Expressions separated by comma
             // Actually, ranges token is different.
             
             const args: number[] = [];
             
             while (peek().type !== 'RPAREN' && peek().type !== 'EOF') {
                  const t = peek();
                  if (t.type === 'RANGE') {
                      consume();
                      const rangeVals = getRangeValues(t.value, data);
                      args.push(...rangeVals);
                  } else if (t.type === 'NAME') {
                      consume();
                      const range = namedRanges[t.value];
                      if (range) {
                          args.push(...getRangeValues(
                              `${columnIndexToName(range.start.col)}${range.start.row + 1}:${columnIndexToName(range.end.col)}${range.end.row + 1}`,
                              data,
                          ));
                      }
                  } else {
                      // Expression might match Ref or Number
                      args.push(parseExpression());
                  }
                  
                  if (peek().type === 'COMMA') consume();
             }
             
             if (peek().type === 'RPAREN') consume();
             
             switch (funcName) {
                 case 'SUM': return args.reduce((a,b) => a+b, 0);
                 case 'AVERAGE': return args.length ? args.reduce((a,b)=>a+b, 0) / args.length : 0;
                 case 'MIN': return Math.min(...args);
                 case 'MAX': return Math.max(...args);
                 case 'COUNT': return args.length;
                 case 'DATE': return datePartsToSerial(args[0] ?? 0, args[1] ?? 1, args[2] ?? 1);
                 case 'TIME': return timePartsToSerial(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
                 case 'YEAR': return serialToDate(args[0] ?? 0).getUTCFullYear();
                 case 'MONTH': return serialToDate(args[0] ?? 0).getUTCMonth() + 1;
                 case 'DAY': return serialToDate(args[0] ?? 0).getUTCDate();
                 case 'HOUR': return Math.floor(((args[0] ?? 0) % 1) * 24 + 1e-9);
                 case 'MINUTE': return Math.floor(((args[0] ?? 0) * 1440 + 1e-7) % 60);
                 case 'SECOND': return Math.floor(((args[0] ?? 0) * 86400 + 1e-5) % 60);
                 case 'TODAY': {
                     const now = new Date();
                     return datePartsToSerial(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
                 }
                 case 'NOW': return dateToSerial(new Date());
                 default: return 0;
             }
        }
        
        const result = parseExpression();
        return isNaN(result) ? '#REF!' : result; // Simplistic error handling
        
    } catch (e) {
        console.error("Formula Error", e);
        return '#ERROR';
    }
}
