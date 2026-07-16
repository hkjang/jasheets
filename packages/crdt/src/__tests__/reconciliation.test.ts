import { reconcileUpdates, SheetDocument } from '../index';

describe('deterministic CRDT reconciliation', () => {
  it('converges after concurrent writes arrive in opposite orders', () => {
    const first = new SheetDocument('client-a');
    const second = new SheetDocument('client-b');

    first.setCell(0, 0, { value: 'base' });
    second.applyUpdate(first.encodeState());

    first.setCell(0, 0, { value: 'from-a' });
    second.setCell(0, 0, { value: 'from-b' });
    const fromFirst = first.encodeState();
    const fromSecond = second.encodeState();

    first.applyUpdate(fromSecond);
    second.applyUpdate(fromFirst);

    expect(first.getCell(0, 0)).toEqual(second.getCell(0, 0));
    expect(Array.from(first.encodeState())).toEqual(Array.from(second.encodeState()));
    first.destroy();
    second.destroy();
  });

  it('produces the same canonical merged update for every input order', () => {
    const first = new SheetDocument('client-a');
    const second = new SheetDocument('client-b');
    first.setCell(1, 1, { value: 1 });
    second.setCell(2, 2, { value: 2 });
    const a = first.encodeState();
    const b = second.encodeState();

    expect(Array.from(reconcileUpdates([a, b]))).toEqual(Array.from(reconcileUpdates([b, a])));
    first.destroy();
    second.destroy();
  });

  it('reconciles batch changes without losing independent cells', () => {
    const source = new SheetDocument('source');
    source.setCells([
      { row: 0, col: 0, data: { value: 1 } },
      { row: 0, col: 1, data: { value: 2 } },
    ]);
    const target = new SheetDocument('target');
    target.applyUpdate(reconcileUpdates([source.encodeState()]));
    expect(target.getCell(0, 0)?.value).toBe(1);
    expect(target.getCell(0, 1)?.value).toBe(2);
    source.destroy();
    target.destroy();
  });
});
