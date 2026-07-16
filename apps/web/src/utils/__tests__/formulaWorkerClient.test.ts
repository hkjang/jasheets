import {
  FormulaWorkerClient,
} from '../formulaWorkerClient';
import type {
  FormulaWorkerLike,
  FormulaWorkerRequest,
  FormulaWorkerResponse,
} from '../formulaWorkerClient';

class FakeWorker implements FormulaWorkerLike {
  messages: FormulaWorkerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FormulaWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: FormulaWorkerRequest): void {
    this.messages.push(message);
  }

  respond(response: FormulaWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<FormulaWorkerResponse>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('FormulaWorkerClient', () => {
  it('matches out-of-order responses to their requests', async () => {
    const worker = new FakeWorker();
    const client = new FormulaWorkerClient(worker);
    const first = client.calculate({ 0: { 0: { value: 1 } } });
    const second = client.calculate({ 0: { 0: { value: 2 } } });

    worker.respond({ id: worker.messages[1].id, data: { 0: { 0: { value: 20 } } } });
    worker.respond({ id: worker.messages[0].id, data: { 0: { 0: { value: 10 } } } });

    await expect(first).resolves.toEqual({ 0: { 0: { value: 10 } } });
    await expect(second).resolves.toEqual({ 0: { 0: { value: 20 } } });
  });

  it('propagates calculation errors', async () => {
    const worker = new FakeWorker();
    const client = new FormulaWorkerClient(worker);
    const calculation = client.calculate({});

    worker.respond({ id: worker.messages[0].id, error: 'invalid formula' });

    await expect(calculation).rejects.toThrow('invalid formula');
  });

  it('rejects pending work when terminated', async () => {
    const worker = new FakeWorker();
    const client = new FormulaWorkerClient(worker);
    const calculation = client.calculate({});

    client.terminate();

    await expect(calculation).rejects.toThrow('terminated');
    expect(worker.terminated).toBe(true);
  });
});
