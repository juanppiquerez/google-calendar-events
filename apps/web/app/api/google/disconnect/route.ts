import { NextResponse } from 'next/server';
import { proxyToApi } from '@/lib/api-proxy';

export async function DELETE() {
  const response = await proxyToApi('/google/disconnect', {
    method: 'DELETE',
  });

  if (response.status === 401) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
