'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function GoogleConnectedToast() {
  useEffect(() => {
    toast.success('Google Calendar conectado correctamente');
  }, []);

  return null;
}
