import { rangesOverlap } from './booking-overlap';

describe('rangesOverlap', () => {
  const hour = (h: number, m = 0) =>
    new Date(
      `2026-06-25T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`,
    );

  it('detects exact same time range', () => {
    expect(rangesOverlap(hour(10), hour(11), hour(10), hour(11))).toBe(true);
  });

  it('detects partial overlap at the start', () => {
    expect(rangesOverlap(hour(10), hour(11, 30), hour(10, 30), hour(12))).toBe(
      true,
    );
  });

  it('detects partial overlap at the end', () => {
    expect(rangesOverlap(hour(10, 30), hour(12), hour(10), hour(11, 30))).toBe(
      true,
    );
  });

  it('detects when one range fully contains the other', () => {
    expect(rangesOverlap(hour(9), hour(13), hour(10), hour(11))).toBe(true);
    expect(rangesOverlap(hour(10), hour(11), hour(9), hour(13))).toBe(true);
  });

  it('returns false when ranges do not overlap', () => {
    expect(rangesOverlap(hour(10), hour(11), hour(12), hour(13))).toBe(false);
    expect(rangesOverlap(hour(12), hour(13), hour(10), hour(11))).toBe(false);
  });

  it('returns false for adjacent ranges (end equals start)', () => {
    expect(rangesOverlap(hour(10), hour(11), hour(11), hour(12))).toBe(false);
    expect(rangesOverlap(hour(11), hour(12), hour(10), hour(11))).toBe(false);
  });

  it('detects overlap when ranges share only the start instant', () => {
    expect(rangesOverlap(hour(10), hour(11), hour(10), hour(10, 30))).toBe(true);
  });

  it('detects overlap when ranges share only the end instant', () => {
    expect(rangesOverlap(hour(10), hour(11), hour(10, 30), hour(11))).toBe(true);
  });

  it('returns false when one range ends before the other starts (gap)', () => {
    expect(rangesOverlap(hour(8), hour(9), hour(10), hour(11))).toBe(false);
  });

  it('is symmetric regardless of argument order', () => {
    const aStart = hour(10);
    const aEnd = hour(12);
    const bStart = hour(11);
    const bEnd = hour(13);
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(
      rangesOverlap(bStart, bEnd, aStart, aEnd),
    );
  });

  it('detects overlap with millisecond-precision boundaries', () => {
    const startA = new Date('2026-06-25T10:00:00.001Z');
    const endA = new Date('2026-06-25T11:00:00.000Z');
    const startB = new Date('2026-06-25T10:59:59.999Z');
    const endB = new Date('2026-06-25T12:00:00.000Z');
    expect(rangesOverlap(startA, endA, startB, endB)).toBe(true);
  });
});
