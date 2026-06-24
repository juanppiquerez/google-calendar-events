/**
 * Returns true when two time ranges overlap (exclusive of adjacent boundaries).
 * Ranges [a, b) and [c, d) overlap when a < d AND b > c.
 */
export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}
