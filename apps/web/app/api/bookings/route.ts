import { NextRequest, NextResponse } from 'next/server';
import { proxyToApi } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');
  const query = status ? `?status=${encodeURIComponent(status)}` : '';

  const response = await proxyToApi(`/bookings${query}`);

  if (response.status === 401) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
  const payload = await request.text();

  const response = await proxyToApi('/bookings', {
    method: 'POST',
    body: payload,
    headers: idempotencyKey
      ? { 'Idempotency-Key': idempotencyKey }
      : undefined,
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
