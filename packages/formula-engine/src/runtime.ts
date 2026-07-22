import { NamedRanges, SheetData } from './model';
import { datePartsToSerial, dateToSerial, serialToDate, timePartsToSerial } from './dateSerial';
import { normalizeLocalizedFormula } from './localeNumber';

/**
 * Basic Formula Engine for JaSheets
 * Supports:
 * - Arithmetic: +, -, *, /, (, )
 * - Functions: aggregation, statistics, lookup, text, date/time, and dynamic arrays
 * - References: A1, B2, A1:B2 (Ranges)
 */

export type TokenType = 'NUMBER' | 'STRING' | 'REF' | 'RANGE' | 'SHEET_REF' | 'SHEET_RANGE' | 'NAME' | 'FUNCTION' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = ['+', '-', '*', '/', '^', '%', '&', '=', '<', '>'];
const FUNCTIONS = [
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'MEDIAN',
  'STDEV', 'STDEV.S', 'STDEV.P', 'STDEVP', 'VAR', 'VAR.S', 'VAR.P', 'VARP',
  'SEQUENCE', 'UNIQUE', 'SORT', 'FILTER',
  'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'AVERAGEIF', 'AVERAGEIFS',
  'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'TODAY', 'NOW',
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'XLOOKUP',
  'IF', 'IFERROR', 'IFNA',
  'LEN', 'LEFT', 'RIGHT', 'MID', 'LOWER', 'UPPER', 'PROPER', 'TRIM', 'CLEAN',
  'REPT', 'SUBSTITUTE', 'REPLACE', 'FIND', 'SEARCH', 'EXACT',
];

export type FormulaResult = string | number | boolean | number[][];
export type FormulaWorkbook = Record<string, SheetData>;

interface QualifiedReference {
  sheetName: string;
  reference: string;
}

const CELL_REFERENCE_SOURCE = '\\$?[A-Za-z]+\\$?[1-9][0-9]*';
const QUALIFIED_REFERENCE = new RegExp(
  `^(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!(${CELL_REFERENCE_SOURCE}(?::${CELL_REFERENCE_SOURCE})?)`,
);

function readQualifiedReference(input: string): QualifiedReference | null {
  const match = input.match(QUALIFIED_REFERENCE);
  if (!match) return null;
  return {
    sheetName: (match[1] ? match[1].replace(/''/g, "'") : match[2]),
    reference: match[3].toUpperCase(),
  };
}

function parseQualifiedReference(input: string): QualifiedReference | null {
  const match = input.match(QUALIFIED_REFERENCE);
  return match?.[0].length === input.length ? readQualifiedReference(input) : null;
}

function resolveWorkbookSheet(workbook: FormulaWorkbook | undefined, sheetName: string): SheetData | null {
  if (!workbook) return null;
  if (workbook[sheetName]) return workbook[sheetName];
  const normalized = sheetName.toLocaleLowerCase();
  const match = Object.entries(workbook).find(([name]) => name.toLocaleLowerCase() === normalized);
  return match?.[1] ?? null;
}

function qualifiedTokenValue(reference: QualifiedReference): string {
  return `${reference.sheetName}!${reference.reference}`;
}

function splitQualifiedToken(value: string): QualifiedReference {
  const separator = value.lastIndexOf('!');
  return { sheetName: value.slice(0, separator), reference: value.slice(separator + 1) };
}

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
      let operator = char;
      if ((char === '<' || char === '>') && formula[i + 1] === '=') {
        operator += formula[i + 1];
        i++;
      } else if (char === '<' && formula[i + 1] === '>') {
        operator += formula[i + 1];
        i++;
      }
      tokens.push({ type: 'OPERATOR', value: operator });
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

    if (char === "'") {
      const qualified = readQualifiedReference(formula.slice(i));
      if (qualified) {
        const consumed = formula.slice(i).match(QUALIFIED_REFERENCE)![0].length;
        tokens.push({
          type: qualified.reference.includes(':') ? 'SHEET_RANGE' : 'SHEET_REF',
          value: qualifiedTokenValue(qualified),
        });
        i += consumed;
        continue;
      }
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      i++;
      while (i < formula.length) {
        if (formula[i] === quote) {
          if (formula[i + 1] === quote) {
            value += quote;
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += formula[i];
        i++;
      }
      tokens.push({ type: 'STRING', value });
      continue;
    }

    if (/[A-Za-z$]/.test(char)) {
      const qualified = readQualifiedReference(formula.slice(i));
      if (qualified) {
        const consumed = formula.slice(i).match(QUALIFIED_REFERENCE)![0].length;
        tokens.push({
          type: qualified.reference.includes(':') ? 'SHEET_RANGE' : 'SHEET_REF',
          value: qualifiedTokenValue(qualified),
        });
        i += consumed;
        continue;
      }
      let word = '';
      while (i < formula.length && /[A-Za-z0-9.:$]/.test(formula[i])) { // Include punctuation used by ranges and dotted function names
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

function getRangeMatrix(range: string, data: SheetData): Array<Array<string | number | boolean | null>> {
    const [startRef, endRef] = range.split(':');
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef);
    if (!start || !end) return [];

    const rows: Array<Array<string | number | boolean | null>> = [];
    for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
        const values: Array<string | number | boolean | null> = [];
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
            values.push(data[row]?.[col]?.value ?? null);
        }
        rows.push(values);
    }
    return rows;
}

function splitFunctionArgs(input: string): string[] {
    const args: string[] = [];
    let start = 0;
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quote) {
            if (char === quote && input[i - 1] !== '\\') quote = null;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
        } else if (char === ',' && depth === 0) {
            args.push(input.slice(start, i).trim());
            start = i + 1;
        }
    }
    args.push(input.slice(start).trim());
    return args;
}

function parseStringLiteral(argument: string): string | undefined {
    const quote = argument[0];
    if ((quote !== '"' && quote !== "'") || argument.length < 2) return undefined;
    let value = '';
    for (let i = 1; i < argument.length; i++) {
        if (argument[i] !== quote) {
            value += argument[i];
            continue;
        }
        if (argument[i + 1] === quote) {
            value += quote;
            i++;
            continue;
        }
        return i === argument.length - 1 ? value : undefined;
    }
    return undefined;
}

function lookupValue(
    argument: string,
    data: SheetData,
    workbook?: FormulaWorkbook,
): string | number | boolean | null {
    const stringLiteral = parseStringLiteral(argument);
    if (stringLiteral !== undefined) return stringLiteral;
    if (/^(TRUE|FALSE)$/i.test(argument)) return argument.toUpperCase() === 'TRUE';
    if (!Number.isNaN(Number(argument))) return Number(argument);
    const qualified = parseQualifiedReference(argument);
    if (qualified) {
        const target = resolveWorkbookSheet(workbook, qualified.sheetName);
        const ref = parseCellRef(qualified.reference);
        return target && ref ? (target[ref.row]?.[ref.col]?.value ?? null) : '#REF!';
    }
    const ref = parseCellRef(argument.toUpperCase());
    return ref ? (data[ref.row]?.[ref.col]?.value ?? null) : argument;
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (typeof left === 'string' && typeof right === 'string') {
        return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
    }
    return left === right;
}

function isFormulaError(value: unknown): value is string {
    return typeof value === 'string' && /^#[A-Z0-9/?!]+/.test(value);
}

function findTopLevelComparison(input: string): { left: string; operator: string; right: string } | null {
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quote) {
            if (char === quote && input[i - 1] !== '\\') quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '(') {
            depth++;
            continue;
        }
        if (char === ')') {
            depth--;
            continue;
        }
        if (depth !== 0 || !['=', '<', '>'].includes(char)) continue;
        const twoCharacter = input.slice(i, i + 2);
        const operator = ['<=', '>=', '<>'].includes(twoCharacter) ? twoCharacter : char;
        return {
            left: input.slice(0, i).trim(),
            operator,
            right: input.slice(i + operator.length).trim(),
        };
    }
    return null;
}

function splitTopLevelConcatenation(input: string): string[] | null {
    const parts: string[] = [];
    let start = 0;
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quote) {
            if (char === quote && input[i + 1] === quote) {
                i++;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
        } else if (char === '&' && depth === 0) {
            parts.push(input.slice(start, i).trim());
            start = i + 1;
        }
    }
    if (parts.length === 0) return null;
    parts.push(input.slice(start).trim());
    return parts;
}

function compareValues(left: string | number | boolean | null, operator: string, right: string | number | boolean | null): boolean {
    if (operator === '=') return valuesEqual(left, right);
    if (operator === '<>') return !valuesEqual(left, right);

    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const numeric = left !== '' && left !== null && right !== '' && right !== null
        && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
    const comparison = numeric
        ? leftNumber - rightNumber
        : String(left ?? '').localeCompare(String(right ?? ''), undefined, { sensitivity: 'accent' });
    if (operator === '<') return comparison < 0;
    if (operator === '<=') return comparison <= 0;
    if (operator === '>') return comparison > 0;
    return comparison >= 0;
}

function evaluateArgument(
    argument: string,
    data: SheetData,
    namedRanges: NamedRanges,
    locale: string,
    workbook?: FormulaWorkbook,
): FormulaResult {
    const trimmed = argument.trim();
    if (parseStringLiteral(trimmed) !== undefined || /^(?:TRUE|FALSE)$/i.test(trimmed) || !Number.isNaN(Number(trimmed))) {
        return lookupValue(trimmed, data, workbook) ?? '';
    }
    const qualified = parseQualifiedReference(trimmed);
    if (qualified) {
        const target = resolveWorkbookSheet(workbook, qualified.sheetName);
        const ref = parseCellRef(qualified.reference);
        return target && ref ? (target[ref.row]?.[ref.col]?.value ?? 0) : '#REF!';
    }
    const ref = parseCellRef(trimmed.toUpperCase());
    if (ref) return data[ref.row]?.[ref.col]?.value ?? 0;
    return evaluateFormula(`=${trimmed}`, data, namedRanges, locale, workbook);
}

function evaluateTextFormula(
    formula: string,
    data: SheetData,
    namedRanges: NamedRanges,
    locale: string,
    workbook?: FormulaWorkbook,
): FormulaResult | undefined {
    const match = formula.match(/^=(LEN|LEFT|RIGHT|MID|LOWER|UPPER|PROPER|TRIM|CLEAN|REPT|SUBSTITUTE|REPLACE|FIND|SEARCH|EXACT)\((.*)\)$/i);
    if (!match) return undefined;

    const name = match[1].toUpperCase();
    const args = splitFunctionArgs(match[2]);
    const values: Array<string | number | boolean> = [];
    for (const argument of args) {
        if (!argument) return '#VALUE!';
        const value = evaluateArgument(argument, data, namedRanges, locale, workbook);
        if (isFormulaError(value)) return value;
        if (Array.isArray(value)) return '#VALUE!';
        values.push(value);
    }

    const text = (index: number) => String(values[index] ?? '');
    const characters = (index: number) => Array.from(text(index));
    const integer = (index: number, fallback?: number): number | null => {
        if (values[index] === undefined) return fallback ?? null;
        const value = Number(values[index]);
        return Number.isFinite(value) ? Math.trunc(value) : null;
    };
    const exactArgs = (count: number) => args.length === count;

    if (name === 'LEN') return exactArgs(1) ? characters(0).length : '#VALUE!';
    if (name === 'LOWER') return exactArgs(1) ? text(0).toLocaleLowerCase(locale) : '#VALUE!';
    if (name === 'UPPER') return exactArgs(1) ? text(0).toLocaleUpperCase(locale) : '#VALUE!';
    if (name === 'TRIM') return exactArgs(1) ? text(0).trim().replace(/ +/g, ' ') : '#VALUE!';
    if (name === 'CLEAN') return exactArgs(1) ? text(0).replace(/[\u0000-\u001f\u007f]/g, '') : '#VALUE!';
    if (name === 'EXACT') return exactArgs(2) ? text(0) === text(1) : '#VALUE!';
    if (name === 'PROPER') {
        if (!exactArgs(1)) return '#VALUE!';
        return text(0).toLocaleLowerCase(locale).replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, prefix: string, letter: string) => (
            prefix + letter.toLocaleUpperCase(locale)
        ));
    }

    if (name === 'LEFT' || name === 'RIGHT') {
        if (args.length < 1 || args.length > 2) return '#VALUE!';
        const count = integer(1, 1);
        if (count === null || count < 0) return '#VALUE!';
        const input = characters(0);
        return name === 'LEFT' ? input.slice(0, count).join('') : input.slice(Math.max(0, input.length - count)).join('');
    }
    if (name === 'MID') {
        if (!exactArgs(3)) return '#VALUE!';
        const start = integer(1);
        const count = integer(2);
        if (start === null || count === null || start < 1 || count < 0) return '#VALUE!';
        return characters(0).slice(start - 1, start - 1 + count).join('');
    }
    if (name === 'REPT') {
        if (!exactArgs(2)) return '#VALUE!';
        const count = integer(1);
        if (count === null || count < 0 || text(0).length * count > 32767) return '#VALUE!';
        return text(0).repeat(count);
    }
    if (name === 'SUBSTITUTE') {
        if (args.length < 3 || args.length > 4 || text(1) === '') return '#VALUE!';
        if (args.length === 3) return text(0).split(text(1)).join(text(2));
        const occurrence = integer(3);
        if (occurrence === null || occurrence < 1) return '#VALUE!';
        let seen = 0;
        return text(0).replaceAll(text(1), (value) => (++seen === occurrence ? text(2) : value));
    }
    if (name === 'REPLACE') {
        if (!exactArgs(4)) return '#VALUE!';
        const start = integer(1);
        const count = integer(2);
        if (start === null || count === null || start < 1 || count < 0) return '#VALUE!';
        const input = characters(0);
        input.splice(start - 1, count, ...Array.from(text(3)));
        return input.join('');
    }
    if (name === 'FIND' || name === 'SEARCH') {
        if (args.length < 2 || args.length > 3) return '#VALUE!';
        const start = integer(2, 1);
        if (start === null || start < 1 || start > characters(1).length + 1) return '#VALUE!';
        const haystack = name === 'SEARCH' ? text(1).toLocaleLowerCase(locale) : text(1);
        const needle = name === 'SEARCH' ? text(0).toLocaleLowerCase(locale) : text(0);
        const offset = Array.from(text(1)).slice(0, start - 1).join('').length;
        const found = haystack.indexOf(needle, offset);
        return found < 0 ? '#VALUE!' : Array.from(text(1).slice(0, found)).length + 1;
    }
    return undefined;
}

function evaluateLookupFormula(
    formula: string,
    data: SheetData,
    namedRanges: NamedRanges,
    workbook?: FormulaWorkbook,
): FormulaResult | undefined {
    const match = formula.match(/^=(VLOOKUP|HLOOKUP|INDEX|MATCH|XLOOKUP)\((.*)\)$/i);
    if (!match) return undefined;
    const name = match[1].toUpperCase();
    const args = splitFunctionArgs(match[2]);
    const matrixFor = (argument: string) => {
        const named = namedRanges[argument.toUpperCase()];
        const qualified = parseQualifiedReference(argument);
        if (qualified) {
            const target = resolveWorkbookSheet(workbook, qualified.sheetName);
            return target ? getRangeMatrix(qualified.reference, target) : [];
        }
        const range = named
            ? `${columnIndexToName(named.start.col)}${named.start.row + 1}:${columnIndexToName(named.end.col)}${named.end.row + 1}`
            : argument.toUpperCase();
        return getRangeMatrix(range, data);
    };
    const scalar = (value: string | number | boolean | null | undefined): FormulaResult => value ?? '#N/A';

    if (name === 'VLOOKUP') {
        const key = lookupValue(args[0], data, workbook);
        const table = matrixFor(args[1]);
        const column = Number(args[2]) - 1;
        const row = table.find((candidate) => valuesEqual(candidate[0], key));
        return column < 0 || column >= (table[0]?.length ?? 0) ? '#REF!' : scalar(row?.[column]);
    }
    if (name === 'HLOOKUP') {
        const key = lookupValue(args[0], data, workbook);
        const table = matrixFor(args[1]);
        const rowIndex = Number(args[2]) - 1;
        const column = table[0]?.findIndex((candidate) => valuesEqual(candidate, key)) ?? -1;
        return rowIndex < 0 || rowIndex >= table.length ? '#REF!' : scalar(column < 0 ? undefined : table[rowIndex][column]);
    }
    if (name === 'MATCH') {
        const key = lookupValue(args[0], data, workbook);
        const values = matrixFor(args[1]).flat();
        const index = values.findIndex((candidate) => valuesEqual(candidate, key));
        return index < 0 ? '#N/A' : index + 1;
    }
    if (name === 'INDEX') {
        const table = matrixFor(args[0]);
        const row = Number(args[1]) - 1;
        const col = Number(args[2] ?? 1) - 1;
        return row < 0 || col < 0 || row >= table.length || col >= (table[0]?.length ?? 0)
            ? '#REF!'
            : scalar(table[row][col]);
    }

    const key = lookupValue(args[0], data, workbook);
    const lookup = matrixFor(args[1]).flat();
    const returns = matrixFor(args[2]).flat();
    const index = lookup.findIndex((candidate) => valuesEqual(candidate, key));
    return index < 0 ? scalar(args[3] ? lookupValue(args[3], data, workbook) : undefined) : scalar(returns[index]);
}

type MatrixValue = string | number | boolean | null;

function resolveRangeMatrix(
    argument: string,
    data: SheetData,
    namedRanges: NamedRanges,
    workbook?: FormulaWorkbook,
): MatrixValue[][] | null {
    const trimmed = argument.trim();
    const qualified = parseQualifiedReference(trimmed);
    if (qualified) {
        const target = resolveWorkbookSheet(workbook, qualified.sheetName);
        return target ? getRangeMatrix(qualified.reference, target) : null;
    }

    const named = namedRanges[trimmed.toUpperCase()];
    if (named) {
        return getRangeMatrix(
            `${columnIndexToName(named.start.col)}${named.start.row + 1}:${columnIndexToName(named.end.col)}${named.end.row + 1}`,
            data,
        );
    }

    const upper = trimmed.toUpperCase();
    if (/^\$?[A-Z]+\$?[1-9][0-9]*(?::\$?[A-Z]+\$?[1-9][0-9]*)?$/.test(upper)) {
        return getRangeMatrix(upper.includes(':') ? upper : `${upper}:${upper}`, data);
    }
    return null;
}

function wildcardPattern(criteria: string): RegExp {
    let source = '';
    for (let index = 0; index < criteria.length; index++) {
        const char = criteria[index];
        if (char === '~' && index + 1 < criteria.length && ['*', '?', '~'].includes(criteria[index + 1])) {
            source += criteria[++index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (char === '*') {
            source += '.*';
        } else if (char === '?') {
            source += '.';
        } else {
            source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`, 'i');
}

function matchesCriterion(value: MatrixValue, criterion: MatrixValue): boolean {
    if (typeof criterion !== 'string') {
        if (typeof criterion === 'number' && value !== null && value !== '' && !Number.isNaN(Number(value))) {
            return Number(value) === criterion;
        }
        return valuesEqual(value, criterion);
    }
    const match = criterion.match(/^(<=|>=|<>|=|<|>)([\s\S]*)$/);
    const operator = match?.[1] ?? '=';
    const operandText = match?.[2] ?? criterion;
    const normalizedOperand: MatrixValue = /^(TRUE|FALSE)$/i.test(operandText)
        ? operandText.toUpperCase() === 'TRUE'
        : operandText !== '' && !Number.isNaN(Number(operandText))
            ? Number(operandText)
            : operandText;

    if ((operator === '=' || operator === '<>') && typeof normalizedOperand === 'string'
        && /[*?~]/.test(normalizedOperand)) {
        const matches = wildcardPattern(normalizedOperand).test(String(value ?? ''));
        return operator === '=' ? matches : !matches;
    }
    if ((operator === '=' || operator === '<>') && normalizedOperand === '') {
        const matches = value === null || value === '';
        return operator === '=' ? matches : !matches;
    }
    if ((operator === '=' || operator === '<>') && typeof normalizedOperand === 'number'
        && value !== null && value !== '' && !Number.isNaN(Number(value))) {
        const matches = Number(value) === normalizedOperand;
        return operator === '=' ? matches : !matches;
    }
    return compareValues(value, operator, normalizedOperand);
}

function evaluateConditionalAggregate(
    formula: string,
    data: SheetData,
    namedRanges: NamedRanges,
    locale: string,
    workbook?: FormulaWorkbook,
): FormulaResult | undefined {
    const match = formula.match(/^=(SUMIF|SUMIFS|COUNTIF|COUNTIFS|AVERAGEIF|AVERAGEIFS)\(([\s\S]*)\)$/i);
    if (!match) return undefined;
    const name = match[1].toUpperCase();
    const args = splitFunctionArgs(match[2]);
    const plural = name.endsWith('IFS');
    const count = name.startsWith('COUNT');
    if ((!plural && count && args.length !== 2)
        || (!plural && !count && (args.length < 2 || args.length > 3))) return '#VALUE!';
    const targetArgument = count ? undefined : (plural ? args.shift() : args[2] ?? args[0]);
    const conditionArgs = count || plural ? args : args.slice(0, 2);
    if (conditionArgs.length < 2 || conditionArgs.length % 2 !== 0) return '#VALUE!';

    const conditions: Array<{ values: MatrixValue[]; criterion: MatrixValue }> = [];
    for (let index = 0; index < conditionArgs.length; index += 2) {
        const matrix = resolveRangeMatrix(conditionArgs[index], data, namedRanges, workbook);
        if (!matrix) return '#REF!';
        const evaluated = evaluateArgument(conditionArgs[index + 1], data, namedRanges, locale, workbook);
        if (isFormulaError(evaluated)) return evaluated;
        if (Array.isArray(evaluated)) return '#VALUE!';
        conditions.push({ values: matrix.flat(), criterion: evaluated });
    }

    const size = conditions[0].values.length;
    if (conditions.some((condition) => condition.values.length !== size)) return '#VALUE!';
    const target = targetArgument
        ? resolveRangeMatrix(targetArgument, data, namedRanges, workbook)?.flat()
        : undefined;
    if (targetArgument && (!target || target.length !== size)) return '#VALUE!';

    const selected: MatrixValue[] = [];
    for (let index = 0; index < size; index++) {
        if (conditions.every((condition) => matchesCriterion(condition.values[index], condition.criterion))) {
            selected.push(target?.[index] ?? conditions[0].values[index]);
        }
    }
    if (count) return selected.length;
    const error = selected.find(isFormulaError);
    if (error) return error;
    const numbers = selected
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (name.startsWith('AVERAGE')) return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : '#DIV/0!';
    return numbers.reduce((sum, value) => sum + value, 0);
}

function matrixKey(values: MatrixValue[]): string {
    return JSON.stringify(values.map((value) => [typeof value, value]));
}

function transposeMatrix(matrix: MatrixValue[][]): MatrixValue[][] {
    return Array.from(
        { length: matrix[0]?.length ?? 0 },
        (_, column) => matrix.map((row) => row[column] ?? null),
    );
}

function dynamicArrayResult(matrix: MatrixValue[][]): FormulaResult {
    if (matrix.length * (matrix[0]?.length ?? 0) > 10000) return '#NUM!';
    // The spreadsheet spill path currently types arrays as numeric even though cell
    // values support text and booleans. Preserve the public type until that path is
    // widened while returning the same heterogeneous values at runtime.
    return matrix as number[][];
}

function evaluateDynamicArrayFormula(
    formula: string,
    data: SheetData,
    namedRanges: NamedRanges,
    locale: string,
    workbook?: FormulaWorkbook,
): FormulaResult | undefined {
    const match = formula.match(/^=(UNIQUE|SORT|FILTER)\(([\s\S]*)\)$/i);
    if (!match) return undefined;

    const name = match[1].toUpperCase();
    const args = splitFunctionArgs(match[2]);
    const source = resolveRangeMatrix(args[0] ?? '', data, namedRanges, workbook);
    if (!source) return '#REF!';
    if (!source.length || !source[0]?.length) return '#CALC!';
    if (source.some((row) => row.length !== source[0].length)) return '#VALUE!';

    if (name === 'UNIQUE') {
        if (args.length > 3) return '#VALUE!';
        const byColumn = args[1]
            ? evaluateArgument(args[1], data, namedRanges, locale, workbook)
            : false;
        const exactlyOnce = args[2]
            ? evaluateArgument(args[2], data, namedRanges, locale, workbook)
            : false;
        if (isFormulaError(byColumn)) return byColumn;
        if (isFormulaError(exactlyOnce)) return exactlyOnce;
        if (Array.isArray(byColumn) || Array.isArray(exactlyOnce)) return '#VALUE!';

        const input = byColumn ? transposeMatrix(source) : source;
        const counts = new Map<string, number>();
        input.forEach((row) => counts.set(matrixKey(row), (counts.get(matrixKey(row)) ?? 0) + 1));
        const seen = new Set<string>();
        const unique = input.filter((row) => {
            const key = matrixKey(row);
            if (exactlyOnce) return counts.get(key) === 1;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        const result = byColumn ? transposeMatrix(unique) : unique;
        return result.length && result[0]?.length ? dynamicArrayResult(result) : '#CALC!';
    }

    if (name === 'SORT') {
        if (args.length > 1 && (args.length - 1) % 2 !== 0) return '#VALUE!';
        const specifications: Array<{ column: number; ascending: boolean }> = [];
        for (let index = 1; index < args.length; index += 2) {
            const columnValue = evaluateArgument(args[index], data, namedRanges, locale, workbook);
            const ascendingValue = evaluateArgument(args[index + 1], data, namedRanges, locale, workbook);
            if (isFormulaError(columnValue)) return columnValue;
            if (isFormulaError(ascendingValue)) return ascendingValue;
            if (Array.isArray(columnValue) || Array.isArray(ascendingValue)) return '#VALUE!';
            const column = Number(columnValue);
            if (!Number.isInteger(column) || column < 1 || column > source[0].length) return '#VALUE!';
            specifications.push({ column: column - 1, ascending: Boolean(ascendingValue) });
        }
        if (!specifications.length) specifications.push({ column: 0, ascending: true });

        const sorted = source.map((row, index) => ({ row, index })).sort((left, right) => {
            for (const specification of specifications) {
                const comparison = compareValues(
                    left.row[specification.column],
                    '<',
                    right.row[specification.column],
                ) ? -1 : compareValues(
                    left.row[specification.column],
                    '>',
                    right.row[specification.column],
                ) ? 1 : 0;
                if (comparison) return specification.ascending ? comparison : -comparison;
            }
            return left.index - right.index;
        }).map(({ row }) => row);
        return dynamicArrayResult(sorted);
    }

    if (args.length < 2) return '#VALUE!';
    const selected = source.map(() => true);
    for (const conditionArgument of args.slice(1)) {
        const comparison = findTopLevelComparison(conditionArgument);
        const rangeArgument = comparison?.left ?? conditionArgument;
        const condition = resolveRangeMatrix(rangeArgument, data, namedRanges, workbook);
        if (!condition) return '#REF!';
        if (condition.length !== source.length || condition.some((row) => row.length !== 1)) return '#VALUE!';

        let expected: FormulaResult = true;
        if (comparison) {
            expected = evaluateArgument(comparison.right, data, namedRanges, locale, workbook);
            if (isFormulaError(expected)) return expected;
            if (Array.isArray(expected)) return '#VALUE!';
        }
        condition.forEach((row, index) => {
            selected[index] = selected[index] && (comparison
                ? compareValues(row[0], comparison.operator, expected as MatrixValue)
                : Boolean(row[0]));
        });
    }
    const filtered = source.filter((_, index) => selected[index]);
    return filtered.length ? dynamicArrayResult(filtered) : '#N/A';
}

export function evaluateFormula(
    formula: string,
    data: SheetData,
    namedRanges: NamedRanges = {},
    locale: string = 'en-US',
    workbook?: FormulaWorkbook,
): FormulaResult {
    try {
        if (!formula.startsWith('=')) return formula;
        formula = normalizeLocalizedFormula(formula, locale);

        const directValue = formula.slice(1).trim();
        if (parseStringLiteral(directValue) !== undefined || /^(?:TRUE|FALSE)$/i.test(directValue)) {
            return lookupValue(directValue, data, workbook) ?? '';
        }
        if (formula.includes('#REF!')) return '#REF!';
        const directQualified = parseQualifiedReference(directValue);
        if (directQualified) {
            const target = resolveWorkbookSheet(workbook, directQualified.sheetName);
            const ref = parseCellRef(directQualified.reference);
            return target && ref ? (target[ref.row]?.[ref.col]?.value ?? 0) : '#REF!';
        }
        const directRef = parseCellRef(directValue.toUpperCase());
        if (directRef) return data[directRef.row]?.[directRef.col]?.value ?? 0;

        const conditional = formula.match(/^=IF\((.*)\)$/i);
        if (conditional) {
            const args = splitFunctionArgs(conditional[1]);
            if (args.length < 2 || args.length > 3) return '#VALUE!';
            const condition = evaluateArgument(args[0], data, namedRanges, locale, workbook);
            if (isFormulaError(condition)) return condition;
            const branch = condition ? args[1] : args[2];
            return branch === undefined ? false : evaluateArgument(branch, data, namedRanges, locale, workbook);
        }

        const errorHandler = formula.match(/^=(IFERROR|IFNA)\((.*)\)$/i);
        if (errorHandler) {
            const args = splitFunctionArgs(errorHandler[2]);
            if (args.length !== 2) return '#VALUE!';
            const result = evaluateFormula(`=${args[0]}`, data, namedRanges, locale, workbook);
            const recover = errorHandler[1].toUpperCase() === 'IFERROR'
                ? isFormulaError(result)
                : result === '#N/A';
            if (!recover) return result;
            return evaluateArgument(args[1], data, namedRanges, locale, workbook);
        }

        const textResult = evaluateTextFormula(formula, data, namedRanges, locale, workbook);
        if (textResult !== undefined) return textResult;

        const comparison = findTopLevelComparison(formula.slice(1));
        if (comparison) {
            const left = evaluateArgument(comparison.left, data, namedRanges, locale, workbook);
            if (isFormulaError(left)) return left;
            const right = evaluateArgument(comparison.right, data, namedRanges, locale, workbook);
            if (isFormulaError(right)) return right;
            if (Array.isArray(left) || Array.isArray(right)) return '#VALUE!';
            return compareValues(left, comparison.operator, right);
        }

        const concatenation = splitTopLevelConcatenation(formula.slice(1));
        if (concatenation) {
            let result = '';
            for (const part of concatenation) {
                if (!part) return '#VALUE!';
                const value = evaluateArgument(part, data, namedRanges, locale, workbook);
                if (isFormulaError(value)) return value;
                if (Array.isArray(value)) return '#VALUE!';
                result += String(value ?? '');
            }
            return result;
        }

        const lookupResult = evaluateLookupFormula(formula, data, namedRanges, workbook);
        if (lookupResult !== undefined) return lookupResult;

        const conditionalAggregate = evaluateConditionalAggregate(formula, data, namedRanges, locale, workbook);
        if (conditionalAggregate !== undefined) return conditionalAggregate;

        const dynamicArray = evaluateDynamicArrayFormula(formula, data, namedRanges, locale, workbook);
        if (dynamicArray !== undefined) return dynamicArray;

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
        // Term = Unary { (*|/) Unary }
        // Unary = (+|-) Unary | Power
        // Power = Percent [ ^ Unary ]
        // Percent = Factor { % }
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
            let left = parseUnary();
            while (peek().type === 'OPERATOR' && (peek().value === '*' || peek().value === '/')) {
                 const op = consume().value;
                 const right = parseUnary();
                 if (op === '*') left *= right;
                 else {
                     if (right === 0) throw new Error('#DIV/0!');
                     left /= right;
                 }
            }
            return left;
        }

        function parseUnary(): number {
            if (peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
                const operator = consume().value;
                const value = parseUnary();
                return operator === '-' ? -value : value;
            }
            return parsePower();
        }

        function parsePower(): number {
            const left = parsePercent();
            if (peek().type === 'OPERATOR' && peek().value === '^') {
                consume();
                return Math.pow(left, parseUnary());
            }
            return left;
        }

        function parsePercent(): number {
            let value = parseFactor();
            while (peek().type === 'OPERATOR' && peek().value === '%') {
                consume();
                value /= 100;
            }
            return value;
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
                if (isFormulaError(val)) throw new Error(val);
                const num = parseFloat(String(val));
                return isNaN(num) ? 0 : num;
            }

            if (token.type === 'SHEET_REF') {
                consume();
                const qualified = splitQualifiedToken(token.value);
                const target = resolveWorkbookSheet(workbook, qualified.sheetName);
                const coords = parseCellRef(qualified.reference);
                if (!target || !coords) throw new Error('#REF!');
                const val = target[coords.row]?.[coords.col]?.value;
                if (isFormulaError(val)) throw new Error(val);
                const num = parseFloat(String(val));
                return isNaN(num) ? 0 : num;
            }

            if (token.type === 'NAME') {
                consume();
                const range = namedRanges[token.value];
                if (!range) throw new Error('#NAME?');
                const val = data[range.start.row]?.[range.start.col]?.value;
                if (isFormulaError(val)) throw new Error(val);
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
                  } else if (t.type === 'SHEET_RANGE') {
                      consume();
                      const qualified = splitQualifiedToken(t.value);
                      const target = resolveWorkbookSheet(workbook, qualified.sheetName);
                      if (!target) throw new Error('#REF!');
                      args.push(...getRangeValues(qualified.reference, target));
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
                 case 'MEDIAN': {
                     if (!args.length) throw new Error('#NUM!');
                     const sorted = [...args].sort((a, b) => a - b);
                     const middle = Math.floor(sorted.length / 2);
                     return sorted.length % 2
                         ? sorted[middle]
                         : (sorted[middle - 1] + sorted[middle]) / 2;
                 }
                 case 'STDEV':
                 case 'STDEV.S':
                 case 'VAR':
                 case 'VAR.S': {
                     if (args.length < 2) throw new Error('#DIV/0!');
                     const mean = args.reduce((sum, value) => sum + value, 0) / args.length;
                     const variance = args.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (args.length - 1);
                     return funcName.startsWith('STDEV') ? Math.sqrt(variance) : variance;
                 }
                 case 'STDEV.P':
                 case 'STDEVP':
                 case 'VAR.P':
                 case 'VARP': {
                     if (!args.length) throw new Error('#DIV/0!');
                     const mean = args.reduce((sum, value) => sum + value, 0) / args.length;
                     const variance = args.reduce((sum, value) => sum + (value - mean) ** 2, 0) / args.length;
                     return funcName.startsWith('STDEV') ? Math.sqrt(variance) : variance;
                 }
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
        return isNaN(result) ? '#VALUE!' : result;
        
    } catch (e) {
        if (e instanceof Error && isFormulaError(e.message)) return e.message;
        return '#ERROR';
    }
}
