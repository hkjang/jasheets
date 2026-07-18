import type { NamedRanges, SheetData } from '@/types/spreadsheet';
import type { FormulaWorkbook } from './FormulaEngine';

export interface FormulaWorkerRequest {
  id: number;
  data: SheetData;
  namedRanges: NamedRanges;
  workbook?: FormulaWorkbook;
}

export interface FormulaWorkerResponse {
  id: number;
  data?: SheetData;
  error?: string;
}

export interface FormulaWorkerLike {
  postMessage(message: FormulaWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FormulaWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

interface PendingCalculation {
  resolve: (data: SheetData) => void;
  reject: (error: Error) => void;
}

export class FormulaWorkerClient {
  private nextId = 0;
  private pending = new Map<number, PendingCalculation>();

  constructor(private readonly worker: FormulaWorkerLike) {
    worker.onmessage = ({ data }) => {
      const calculation = this.pending.get(data.id);
      if (!calculation) return;
      this.pending.delete(data.id);
      if (data.error) calculation.reject(new Error(data.error));
      else calculation.resolve(data.data ?? {});
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Formula worker failed');
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    };
  }

  calculate(
    data: SheetData,
    namedRanges: NamedRanges = {},
    workbook?: FormulaWorkbook,
  ): Promise<SheetData> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, data, namedRanges, workbook });
    });
  }

  terminate(): void {
    const error = new Error('Formula worker terminated');
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
    this.worker.terminate();
  }
}
