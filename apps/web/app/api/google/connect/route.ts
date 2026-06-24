import { NextResponse } from 'next/server';
import { proxyToApi } from '@/lib/api-proxy';

export async function GET() {
  const response = await proxyToApi('/google/connect');

  if (response.status === 401) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
