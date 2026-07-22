type CanvasResolutionTarget = Pick<HTMLCanvasElement, 'width' | 'height' | 'style'>;
type CanvasTransformTarget = Pick<CanvasRenderingContext2D, 'setTransform'>;

/** Synchronize the backing store without clearing an already-correct canvas. */
export function syncCanvasResolution(
  canvas: CanvasResolutionTarget,
  context: CanvasTransformTarget,
  width: number,
  height: number,
  devicePixelRatio: number,
): void {
  const physicalWidth = Math.max(1, Math.round(width * devicePixelRatio));
  const physicalHeight = Math.max(1, Math.round(height * devicePixelRatio));
  if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
  if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
