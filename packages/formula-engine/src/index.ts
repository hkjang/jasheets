import { CellValue, CellReference, CellRange } from '@jasheets/shared';
export { CellValue, CellReference, CellRange };

// Token types for lexer
export enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  CELL_REF = 'CELL_REF',
  RANGE = 'RANGE',
  FUNCTION = 'FUNCTION',
  OPERATOR = 'OPERATOR',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  COLON = 'COLON',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// AST Node types
export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellRefNode
  | RangeNode
  | FunctionCallNode
  | BinaryOpNode
  | UnaryOpNode;

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface CellRefNode {
  type: 'CellRef';
  ref: CellReference;
  raw: string;
}

export interface RangeNode {
  type: 'Range';
  start: CellReference;
  end: CellReference;
  raw: string;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: string;
  operand: ASTNode;
}

// Lexer
export class Lexer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private current(): string {
    return this.input[this.position] || '';
  }

  private peek(offset: number = 1): string {
    return this.input[this.position + offset] || '';
  }

  private advance(): string {
    return this.input[this.position++];
  }

  private skipWhitespace(): void {
    while (this.current() === ' ' || this.current() === '\t') {
      this.advance();
    }
  }

  private readNumber(): Token {
    const start = this.position;
    let value = '';

    while (this.isDigit(this.current()) || this.current() === '.') {
      value += this.advance();
    }

    // Handle scientific notation
    if (this.current().toLowerCase() === 'e') {
      value += this.advance();
      if (this.current() === '+' || this.current() === '-') {
        value += this.advance();
      }
      while (this.isDigit(this.current())) {
        value += this.advance();
      }
    }

    return { type: TokenType.NUMBER, value, position: start };
  }

  private readString(): Token {
    const start = this.position;
    const quote = this.advance(); // consume opening quote
    let value = '';

    while (this.current() && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance();
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    this.advance(); // consume closing quote
    return { type: TokenType.STRING, value, position: start };
  }

  private readIdentifier(): Token {
    const start = this.position;
    let value = '';

    // Check for absolute reference ($)
    if (this.current() === '$') {
      value += this.advance();
    }

    while (this.isAlphaNumeric(this.current()) || this.current() === '$') {
      value += this.advance();
    }

    // Check if it's a boolean
    if (value.toUpperCase() === 'TRUE' || value.toUpperCase() === 'FALSE') {
      return { type: TokenType.BOOLEAN, value: value.toUpperCase(), position: start };
    }

    // Check if it's a cell reference (like A1, $B$2, etc.)
    const cellRefPattern = /^\$?[A-Z]+\$?\d+$/i;
    if (cellRefPattern.test(value)) {
      return { type: TokenType.CELL_REF, value: value.toUpperCase(), position: start };
    }

    // Otherwise, it's a function name
    return { type: TokenType.FUNCTION, value: value.toUpperCase(), position: start };
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();

      if (this.position >= this.input.length) break;

      const char = this.current();
      const start = this.position;

      if (this.isDigit(char)) {
        tokens.push(this.readNumber());
      } else if (char === '"' || char === "'") {
        tokens.push(this.readString());
      } else if (this.isAlpha(char) || char === '$') {
        tokens.push(this.readIdentifier());
      } else if (char === '(') {
        tokens.push({ type: TokenType.LPAREN, value: this.advance(), position: start });
      } else if (char === ')') {
        tokens.push({ type: TokenType.RPAREN, value: this.advance(), position: start });
      } else if (char === ',') {
        tokens.push({ type: TokenType.COMMA, value: this.advance(), position: start });
      } else if (char === ':') {
        tokens.push({ type: TokenType.COLON, value: this.advance(), position: start });
      } else if ('+-*/%^&=<>!'.includes(char)) {
        let op = this.advance();
        // Handle two-character operators
        if ((op === '<' || op === '>' || op === '!' || op === '=') && this.current() === '=') {
          op += this.advance();
        } else if (op === '<' && this.current() === '>') {
          op += this.advance(); // <>
        }
        tokens.push({ type: TokenType.OPERATOR, value: op, position: start });
      } else {
        throw new Error(`Unexpected character: ${char} at position ${this.position}`);
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.position });
    return tokens;
  }
}

// Parser
export class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.position];
  }

  private advance(): Token {
    return this.tokens[this.position++];
  }

  private expect(type: TokenType): Token {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return token;
  }

  private parseCellRef(token: Token): CellReference {
    const value = token.value;
    let col = '';
    let row = '';
    let i = 0;
    let colAbsolute = false;
    let rowAbsolute = false;

    if (value[i] === '$') {
      colAbsolute = true;
      i++;
    }

    while (i < value.length && /[A-Z]/i.test(value[i])) {
      col += value[i++];
    }

    if (value[i] === '$') {
      rowAbsolute = true;
      i++;
    }

    while (i < value.length && /[0-9]/.test(value[i])) {
      row += value[i++];
    }

    // Convert column letters to index
    let colIndex = 0;
    for (let j = 0; j < col.length; j++) {
      colIndex = colIndex * 26 + (col.charCodeAt(j) - 64);
    }
    colIndex--;

    return {
      row: parseInt(row, 10) - 1,
      col: colIndex,
      absolute: { row: rowAbsolute, col: colAbsolute },
    };
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.NUMBER:
        this.advance();
        return { type: 'Number', value: parseFloat(token.value) };

      case TokenType.STRING:
        this.advance();
        return { type: 'String', value: token.value };

      case TokenType.BOOLEAN:
        this.advance();
        return { type: 'Boolean', value: token.value === 'TRUE' };

      case TokenType.CELL_REF:
        this.advance();
        const ref = this.parseCellRef(token);

        // Check if it's a range
        if (this.current().type === TokenType.COLON) {
          this.advance();
          const endToken = this.expect(TokenType.CELL_REF);
          const endRef = this.parseCellRef(endToken);
          return {
            type: 'Range',
            start: ref,
            end: endRef,
            raw: `${token.value}:${endToken.value}`,
          };
        }

        return { type: 'CellRef', ref, raw: token.value };

      case TokenType.FUNCTION:
        return this.parseFunctionCall();

      case TokenType.LPAREN:
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expr;

      case TokenType.OPERATOR:
        if (token.value === '-' || token.value === '+') {
          this.advance();
          return {
            type: 'UnaryOp',
            operator: token.value,
            operand: this.parsePrimary(),
          };
        }
        throw new Error(`Unexpected operator: ${token.value}`);

      default:
        throw new Error(`Unexpected token: ${token.type}`);
    }
  }

  private parseFunctionCall(): FunctionCallNode {
    const nameToken = this.expect(TokenType.FUNCTION);
    this.expect(TokenType.LPAREN);

    const args: ASTNode[] = [];

    if (this.current().type !== TokenType.RPAREN) {
      args.push(this.parseExpression());

      while (this.current().type === TokenType.COMMA) {
        this.advance();
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RPAREN);

    return { type: 'FunctionCall', name: nameToken.value, args };
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parsePrimary();

    while (
      this.current().type === TokenType.OPERATOR &&
      ['*', '/', '%', '^'].includes(this.current().value)
    ) {
      const op = this.advance().value;
      const right = this.parsePrimary();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (
      this.current().type === TokenType.OPERATOR &&
      ['+', '-'].includes(this.current().value)
    ) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();

    while (
      this.current().type === TokenType.OPERATOR &&
      ['<', '>', '<=', '>=', '=', '==', '!=', '<>'].includes(this.current().value)
    ) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  private parseExpression(): ASTNode {
    let left = this.parseComparison();

    while (
      this.current().type === TokenType.OPERATOR &&
      ['&'].includes(this.current().value)
    ) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryOp', operator: op, left, right };
    }

    return left;
  }

  parse(): ASTNode {
    const result = this.parseExpression();
    if (this.current().type !== TokenType.EOF) {
      throw new Error(`Unexpected token: ${this.current().type}`);
    }
    return result;
  }
}

// Context for evaluation
export interface EvaluationContext {
  getCellValue(ref: CellReference): CellValue;
  getRangeValues(start: CellReference, end: CellReference): CellValue[][];
}

// Built-in functions
type FormulaFunction = (args: CellValue[], context: EvaluationContext) => CellValue;

const FUNCTIONS: Record<string, FormulaFunction> = {
  SUM: (args) => {
    let sum = 0;
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const row of arg as CellValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number') sum += cell;
          }
        }
      } else if (typeof arg === 'number') {
        sum += arg;
      }
    }
    return sum;
  },

  AVERAGE: (args) => {
    let sum = 0;
    let count = 0;
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const row of arg as CellValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number') {
              sum += cell;
              count++;
            }
          }
        }
      } else if (typeof arg === 'number') {
        sum += arg;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  },

  COUNT: (args) => {
    let count = 0;
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const row of arg as CellValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number') count++;
          }
        }
      } else if (typeof arg === 'number') {
        count++;
      }
    }
    return count;
  },

  MAX: (args) => {
    let max = -Infinity;
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const row of arg as CellValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number' && cell > max) max = cell;
          }
        }
      } else if (typeof arg === 'number' && arg > max) {
        max = arg;
      }
    }
    return max === -Infinity ? 0 : max;
  },

  MIN: (args) => {
    let min = Infinity;
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const row of arg as CellValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number' && cell < min) min = cell;
          }
        }
      } else if (typeof arg === 'number' && arg < min) {
        min = arg;
      }
    }
    return min === Infinity ? 0 : min;
  },

  IF: (args) => {
    const [condition, trueVal, falseVal] = args;
    return condition ? trueVal : (falseVal ?? false);
  },

  AND: (args) => args.every(Boolean),

  OR: (args) => args.some(Boolean),

  NOT: (args) => !args[0],

  CONCAT: (args) => args.map(String).join(''),

  LEN: (args) => String(args[0] ?? '').length,

  UPPER: (args) => String(args[0] ?? '').toUpperCase(),

  LOWER: (args) => String(args[0] ?? '').toLowerCase(),

  TRIM: (args) => String(args[0] ?? '').trim(),

  LEFT: (args) => String(args[0] ?? '').slice(0, Number(args[1]) || 1),

  RIGHT: (args) => {
    const str = String(args[0] ?? '');
    const len = Number(args[1]) || 1;
    return str.slice(-len);
  },

  MID: (args) => {
    const str = String(args[0] ?? '');
    const start = Number(args[1]) - 1 || 0;
    const len = Number(args[2]) || 1;
    return str.slice(start, start + len);
  },

  ABS: (args) => Math.abs(Number(args[0]) || 0),

  ROUND: (args) => {
    const num = Number(args[0]) || 0;
    const decimals = Number(args[1]) || 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  FLOOR: (args) => Math.floor(Number(args[0]) || 0),

  CEILING: (args) => Math.ceil(Number(args[0]) || 0),

  SQRT: (args) => Math.sqrt(Number(args[0]) || 0),

  POWER: (args) => Math.pow(Number(args[0]) || 0, Number(args[1]) || 1),

  NOW: () => new Date().toISOString(),

  TODAY: () => new Date().toISOString().split('T')[0],

  IFERROR: (args) => {
    try {
      return args[0];
    } catch {
      return args[1] ?? '';
    }
  },
};

// Evaluator
export class Evaluator {
  private context: EvaluationContext;

  constructor(context: EvaluationContext) {
    this.context = context;
  }

  evaluate(node: ASTNode): CellValue {
    switch (node.type) {
      case 'Number':
        return node.value;

      case 'String':
        return node.value;

      case 'Boolean':
        return node.value;

      case 'CellRef':
        return this.context.getCellValue(node.ref);

      case 'Range':
        return this.context.getRangeValues(node.start, node.end) as any;

      case 'FunctionCall':
        return this.evaluateFunction(node);

      case 'BinaryOp':
        return this.evaluateBinaryOp(node);

      case 'UnaryOp':
        return this.evaluateUnaryOp(node);

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  private evaluateFunction(node: FunctionCallNode): CellValue {
    const fn = FUNCTIONS[node.name];
    if (!fn) {
      throw new Error(`Unknown function: ${node.name}`);
    }

    const args = node.args.map((arg) => this.evaluate(arg));
    return fn(args, this.context);
  }

  private evaluateBinaryOp(node: BinaryOpNode): CellValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      case '+':
        return (Number(left) || 0) + (Number(right) || 0);
      case '-':
        return (Number(left) || 0) - (Number(right) || 0);
      case '*':
        return (Number(left) || 0) * (Number(right) || 0);
      case '/':
        const divisor = Number(right) || 0;
        if (divisor === 0) throw new Error('#DIV/0!');
        return (Number(left) || 0) / divisor;
      case '%':
        return (Number(left) || 0) % (Number(right) || 0);
      case '^':
        return Math.pow(Number(left) || 0, Number(right) || 0);
      case '&':
        return String(left ?? '') + String(right ?? '');
      case '=':
      case '==':
        return left === right;
      case '!=':
      case '<>':
        return left !== right;
      case '<':
        return (Number(left) || 0) < (Number(right) || 0);
      case '>':
        return (Number(left) || 0) > (Number(right) || 0);
      case '<=':
        return (Number(left) || 0) <= (Number(right) || 0);
      case '>=':
        return (Number(left) || 0) >= (Number(right) || 0);
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  private evaluateUnaryOp(node: UnaryOpNode): CellValue {
    const operand = this.evaluate(node.operand);

    switch (node.operator) {
      case '-':
        return -(Number(operand) || 0);
      case '+':
        return Number(operand) || 0;
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }
}

// Dependency extraction
export function extractDependencies(node: ASTNode): CellReference[] {
  const deps: CellReference[] = [];

  function traverse(n: ASTNode): void {
    switch (n.type) {
      case 'CellRef':
        deps.push(n.ref);
        break;
      case 'Range':
        // Add all cells in range
        for (let row = n.start.row; row <= n.end.row; row++) {
          for (let col = n.start.col; col <= n.end.col; col++) {
            deps.push({ row, col });
          }
        }
        break;
      case 'FunctionCall':
        n.args.forEach(traverse);
        break;
      case 'BinaryOp':
        traverse(n.left);
        traverse(n.right);
        break;
      case 'UnaryOp':
        traverse(n.operand);
        break;
    }
  }

  traverse(node);
  return deps;
}

// Main FormulaEngine class
export class FormulaEngine {
  parse(formula: string): ASTNode {
    // Remove leading = if present
    const input = formula.startsWith('=') ? formula.slice(1) : formula;
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  }

  evaluate(formula: string, context: EvaluationContext): CellValue {
    try {
      const ast = this.parse(formula);
      const evaluator = new Evaluator(context);
      return evaluator.evaluate(ast);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('#')) {
          return error.message;
        }
        return `#ERROR: ${error.message}`;
      }
      return '#ERROR!';
    }
  }

  getDependencies(formula: string): CellReference[] {
    try {
      const ast = this.parse(formula);
      return extractDependencies(ast);
    } catch {
      return [];
    }
  }

  validate(formula: string): { valid: boolean; error?: string } {
    try {
      this.parse(formula);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid formula',
      };
    }
  }
}

export default FormulaEngine;
