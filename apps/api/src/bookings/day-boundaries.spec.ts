import { getDayBoundaries } from './day-boundaries';

describe('getDayBoundaries', () => {
  it('returns UTC midnight to end of day for UTC timezone', () => {
    const { dayStart, dayEnd } = getDayBoundaries('2026-07-15', 'UTC');

    expect(dayStart.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-07-15T23:59:59.999Z');
  });

  it('offsets day bounds for non-UTC timezones', () => {
    const { dayStart, dayEnd } = getDayBoundaries(
      '2026-07-15',
      'America/Argentina/Buenos_Aires',
    );

    expect(dayStart.toISOString()).toBe('2026-07-15T03:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-07-16T02:59:59.999Z');
  });
});
