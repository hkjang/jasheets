export interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export function isTap(start: PointerSample, end: PointerSample, tolerance = 10): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= tolerance;
}

export function isDoubleTap(
  previous: PointerSample | null,
  current: PointerSample,
  interval = 350,
  tolerance = 24,
): boolean {
  return Boolean(
    previous
    && current.time - previous.time > 0
    && current.time - previous.time <= interval
    && Math.hypot(current.x - previous.x, current.y - previous.y) <= tolerance,
  );
}
