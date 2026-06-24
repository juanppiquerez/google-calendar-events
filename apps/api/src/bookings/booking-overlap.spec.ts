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
});
