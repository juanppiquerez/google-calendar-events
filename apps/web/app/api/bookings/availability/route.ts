import { NextRequest, NextResponse } from 'next/server';
import { proxyToApi } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  const timeZone = request.nextUrl.searchParams.get('timeZone');

  if (!date) {
    return NextResponse.json(
      { message: 'date query parameter is required' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ date });
  if (timeZone) {
    params.set('timeZone', timeZone);
  }

  const response = await proxyToApi(`/bookings/availability?${params.toString()}`);

  if (response.status === 401) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
