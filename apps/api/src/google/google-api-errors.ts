export function mapGoogleApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('has not been used in project') ||
    message.includes('it is disabled')
  ) {
    return 'La Google Calendar API no está habilitada en tu proyecto de Google Cloud. Andá a APIs & Services → Library, buscá "Google Calendar API" y habilitala. Luego esperá unos minutos y reconectá tu cuenta.';
  }

  if (message.includes('insufficient authentication scopes')) {
    return 'Faltan permisos de Google Calendar. Desconectá y volvé a conectar tu cuenta para autorizar el acceso actualizado.';
  }

  if (/invalid_grant/i.test(message)) {
    return 'La conexión con Google expiró. Reconectá tu cuenta desde el dashboard.';
  }

  if (message.includes('Failed to decrypt')) {
    return 'No se pudieron leer los tokens de Google. Desconectá y volvé a conectar tu cuenta.';
  }

  return 'No se pudo consultar Google Calendar. Revisá la configuración en Google Cloud Console o reconectá tu cuenta.';
}
