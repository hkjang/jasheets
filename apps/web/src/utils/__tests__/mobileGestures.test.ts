import { isDoubleTap, isTap } from '../mobileGestures';

describe('mobile spreadsheet gestures', () => {
  it('distinguishes taps from scrolling gestures', () => {
    expect(isTap({ x: 10, y: 10, time: 0 }, { x: 16, y: 14, time: 100 })).toBe(true);
    expect(isTap({ x: 10, y: 10, time: 0 }, { x: 10, y: 40, time: 100 })).toBe(false);
  });

  it('recognizes nearby taps within the editing interval', () => {
    const first = { x: 50, y: 80, time: 1_000 };
    expect(isDoubleTap(first, { x: 55, y: 84, time: 1_300 })).toBe(true);
    expect(isDoubleTap(first, { x: 55, y: 84, time: 1_500 })).toBe(false);
    expect(isDoubleTap(first, { x: 100, y: 120, time: 1_200 })).toBe(false);
  });
});
