import { Prisma } from '@prisma/client';
import { isExclusionViolation } from './postgres-errors';

describe('isExclusionViolation', () => {
  it('returns true for raw Postgres exclusion violation code', () => {
    expect(isExclusionViolation({ code: '23P01' })).toBe(true);
  });

  it('returns true for Prisma P2010 wrapper with exclusion meta code', () => {
    expect(
      isExclusionViolation({ code: 'P2010', meta: { code: '23P01' } }),
    ).toBe(true);
  });

  it('returns true for PrismaClientUnknownRequestError containing 23P01', () => {
    const error = new Prisma.PrismaClientUnknownRequestError(
      'exclusion constraint violated (23P01)',
      { clientVersion: '6.0.0' },
    );
    expect(isExclusionViolation(error)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isExclusionViolation(null)).toBe(false);
    expect(isExclusionViolation({ code: 'P2002' })).toBe(false);
    expect(isExclusionViolation(new Error('other'))).toBe(false);
  });
});
