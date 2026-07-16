import { resolveNavigationTarget } from '../useKeyboardNavigation';

const current = { row: 10, col: 5 };
const normal = { shift: false, jump: false };

describe('keyboard navigation', () => {
  it('moves by one cell with arrow keys', () => {
    expect(resolveNavigationTarget('ArrowUp', current, 100, 20, normal)).toEqual({ row: 9, col: 5 });
    expect(resolveNavigationTarget('ArrowRight', current, 100, 20, normal)).toEqual({ row: 10, col: 6 });
  });

  it('jumps to boundaries with modifier arrows, Home, and End', () => {
    const jump = { shift: false, jump: true };
    expect(resolveNavigationTarget('ArrowDown', current, 100, 20, jump)).toEqual({ row: 99, col: 5 });
    expect(resolveNavigationTarget('Home', current, 100, 20, jump)).toEqual({ row: 0, col: 0 });
    expect(resolveNavigationTarget('End', current, 100, 20, jump)).toEqual({ row: 99, col: 19 });
  });

  it('moves by viewport-sized pages', () => {
    expect(resolveNavigationTarget('PageUp', current, 100, 20, normal)).toEqual({ row: 0, col: 5 });
    expect(resolveNavigationTarget('PageDown', current, 100, 20, normal)).toEqual({ row: 30, col: 5 });
  });

  it('wraps Tab and Shift+Tab between rows', () => {
    expect(resolveNavigationTarget('Tab', { row: 2, col: 19 }, 100, 20, normal)).toEqual({ row: 3, col: 0 });
    expect(resolveNavigationTarget('Tab', { row: 2, col: 0 }, 100, 20, { shift: true, jump: false })).toEqual({ row: 1, col: 19 });
  });

  it('never navigates outside sheet bounds', () => {
    expect(resolveNavigationTarget('ArrowUp', { row: 0, col: 0 }, 100, 20, normal)).toEqual({ row: 0, col: 0 });
    expect(resolveNavigationTarget('Enter', { row: 99, col: 19 }, 100, 20, normal)).toEqual({ row: 99, col: 19 });
  });
});
