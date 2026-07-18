/// <reference lib="webworker" />

import { recalculate } from '@/utils/RecalculationEngine';
import type {
  FormulaWorkerRequest,
  FormulaWorkerResponse,
} from '@/utils/formulaWorkerClient';

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = ({ data }: MessageEvent<FormulaWorkerRequest>) => {
  try {
    const response: FormulaWorkerResponse = {
      id: data.id,
      data: recalculate(data.data, data.namedRanges, undefined, data.workbook),
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: FormulaWorkerResponse = {
      id: data.id,
      error: error instanceof Error ? error.message : 'Formula calculation failed',
    };
    workerScope.postMessage(response);
  }
};

export {};
