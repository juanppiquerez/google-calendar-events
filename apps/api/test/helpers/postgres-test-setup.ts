import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const API_ROOT = path.resolve(__dirname, '../..');

export interface PostgresTestContext {
  databaseUrl: string;
  prisma: PrismaClient;
  container: StartedPostgreSqlContainer | null;
}

export async function setupPostgresTestDatabase(): Promise<PostgresTestContext> {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let container: StartedPostgreSqlContainer | null = null;

  if (!databaseUrl) {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('booking_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    databaseUrl = container.getConnectionUri();
  }

  process.env.DATABASE_URL = databaseUrl;

  execSync('npx prisma migrate deploy', {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  return { databaseUrl, prisma, container };
}

export async function teardownPostgresTestDatabase(
  ctx: PostgresTestContext,
): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.container?.stop();
}

export function futureSlot(hoursFromNow = 48) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1_000);
  const end = new Date(start.getTime() + 60 * 60 * 1_000);
  return {
    title: 'Integration test booking',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}
