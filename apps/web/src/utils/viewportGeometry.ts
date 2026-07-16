export interface AxisDefinition {
  size?: number;
  hidden?: boolean;
}

export interface AxisGeometry {
  offsets: number[];
  sizes: number[];
  totalSize: number;
}

export interface VisibleRange {
  start: number;
  end: number;
}

export function buildAxisGeometry(
  count: number,
  definitions: AxisDefinition[],
  defaultSize: number,
): AxisGeometry {
  const offsets = new Array<number>(count + 1);
  const sizes = new Array<number>(count);
  offsets[0] = 0;

  for (let index = 0; index < count; index++) {
    const definition = definitions[index];
    const size = definition?.hidden ? 0 : (definition?.size ?? defaultSize);
    sizes[index] = size;
    offsets[index + 1] = offsets[index] + size;
  }

  return { offsets, sizes, totalSize: offsets[count] };
}

export function findAxisIndex(geometry: AxisGeometry, position: number): number {
  if (position < 0 || position >= geometry.totalSize) return -1;

  let low = 0;
  let high = geometry.sizes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (geometry.offsets[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }

  while (low < geometry.sizes.length && geometry.sizes[low] === 0) low++;
  return low < geometry.sizes.length ? low : -1;
}

export function getVisibleRange(
  geometry: AxisGeometry,
  scrollOffset: number,
  viewportSize: number,
  overscan = 1,
): VisibleRange {
  if (geometry.totalSize === 0 || viewportSize <= 0) return { start: 0, end: -1 };

  const first = findAxisIndex(geometry, Math.max(0, scrollOffset));
  const lastPosition = Math.min(
    geometry.totalSize - 1,
    Math.max(0, scrollOffset + viewportSize - 1),
  );
  const last = findAxisIndex(geometry, lastPosition);

  return {
    start: Math.max(0, first - overscan),
    end: Math.min(geometry.sizes.length - 1, last + overscan),
  };
}
