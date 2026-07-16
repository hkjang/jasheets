import {
  buildAxisGeometry,
  findAxisIndex,
  getVisibleRange,
} from '../viewportGeometry';

describe('viewport geometry', () => {
  it('builds offsets while collapsing hidden entries', () => {
    const geometry = buildAxisGeometry(
      4,
      [{ size: 20 }, { size: 40, hidden: true }, { size: 30 }],
      25,
    );

    expect(geometry.offsets).toEqual([0, 20, 20, 50, 75]);
    expect(geometry.sizes).toEqual([20, 0, 30, 25]);
    expect(geometry.totalSize).toBe(75);
  });

  it('finds entries in logarithmic geometry lookups', () => {
    const geometry = buildAxisGeometry(4, [{ size: 20 }, { hidden: true }, { size: 30 }], 25);

    expect(findAxisIndex(geometry, 0)).toBe(0);
    expect(findAxisIndex(geometry, 19)).toBe(0);
    expect(findAxisIndex(geometry, 20)).toBe(2);
    expect(findAxisIndex(geometry, 74)).toBe(3);
    expect(findAxisIndex(geometry, 75)).toBe(-1);
  });

  it('returns only visible entries plus bounded overscan', () => {
    const geometry = buildAxisGeometry(10_000, [], 25);

    expect(getVisibleRange(geometry, 125_000, 100, 2)).toEqual({
      start: 4_998,
      end: 5_005,
    });
  });
});
