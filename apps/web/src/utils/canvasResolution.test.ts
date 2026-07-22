import { syncCanvasResolution } from './canvasResolution';

describe('syncCanvasResolution', () => {
  it('does not clear the backing store when only canvas contents change', () => {
    let widthWrites = 0;
    let heightWrites = 0;
    let backingWidth = 1600;
    let backingHeight = 1200;
    const canvas = {
      style: {} as CSSStyleDeclaration,
      get width() {
        return backingWidth;
      },
      set width(value: number) {
        widthWrites += 1;
        backingWidth = value;
      },
      get height() {
        return backingHeight;
      },
      set height(value: number) {
        heightWrites += 1;
        backingHeight = value;
      },
    };
    const context = { setTransform: jest.fn() };

    syncCanvasResolution(canvas, context, 800, 600, 2);
    syncCanvasResolution(canvas, context, 800, 600, 2);

    expect(widthWrites).toBe(0);
    expect(heightWrites).toBe(0);
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('updates the backing store once when the viewport changes size', () => {
    const canvas = { width: 800, height: 600, style: {} as CSSStyleDeclaration };
    const context = { setTransform: jest.fn() };

    syncCanvasResolution(canvas, context, 640, 480, 2);

    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(960);
    expect(canvas.style.width).toBe('640px');
    expect(canvas.style.height).toBe('480px');
  });
});
