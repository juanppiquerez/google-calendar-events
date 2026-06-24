'use client';

import { useEffect } from 'react';
import { redirectOnUnauthorized } from '@/lib/api-error';

export function useRedirectOnUnauthorized(error: unknown): void {
  useEffect(() => {
    if (error) {
      redirectOnUnauthorized(error);
    }
  }, [error]);
}
