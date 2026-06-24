import { Prisma } from '@prisma/client';

const EXCLUSION_VIOLATION_CODE = '23P01';

export function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; meta?: { code?: string } };

  if (candidate.code === EXCLUSION_VIOLATION_CODE) {
    return true;
  }

  if (
    candidate.code === 'P2010' &&
    candidate.meta?.code === EXCLUSION_VIOLATION_CODE
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return error.message.includes(EXCLUSION_VIOLATION_CODE);
  }

  return false;
}
