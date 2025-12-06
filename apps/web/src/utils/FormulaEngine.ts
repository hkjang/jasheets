import { SheetData, CellData } from '@/types/spreadsheet';

/**
 * Basic Formula Engine for JaSheets
 * Supports:
 * - Arithmetic: +, -, *, /, (, )
 * - Functions: SUM, AVERAGE, MIN, MAX, COUNT
 * - References: A1, B2, A1:B2 (Ranges)
 */

type TokenType = 'NUMBER' | 'STRING' | 'REF' | 'RANGE' | 'FUNCTION' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = ['+', '-', '*', '/'];
const FUNCTIONS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'];

function tokenize(formula: string): Token[] {
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

    if (/[A-Za-z]/.test(char)) {
      let word = '';
      while (i < formula.length && /[A-Za-z0-9:]/.test(formula[i])) { // Include : for ranges
        word += formula[i];
        i++;
      }
      
      const upper = word.toUpperCase();
      if (FUNCTIONS.includes(upper)) {
        tokens.push({ type: 'FUNCTION', value: upper });
      } else if (word.includes(':')) {
         tokens.push({ type: 'RANGE', value: upper }); // A1:B2
      } else {
         tokens.push({ type: 'REF', value: upper }); // A1
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
    const match = ref.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { row: parseInt(rowStr) - 1, col: col - 1 };
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

export function evaluateFormula(formula: string, data: SheetData): string | number {
    try {
        if (!formula.startsWith('=')) return formula;
        
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
