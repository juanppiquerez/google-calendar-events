import { mapGoogleApiError } from './google-api-errors';

describe('mapGoogleApiError', () => {
  it('maps disabled Calendar API errors', () => {
    const message = mapGoogleApiError(
      new Error(
        'Google Calendar API has not been used in project 123 before or it is disabled.',
      ),
    );

    expect(message).toContain('Google Calendar API no está habilitada');
  });

  it('maps insufficient scope errors', () => {
    const message = mapGoogleApiError(
      new Error('Request had insufficient authentication scopes.'),
    );

    expect(message).toContain('Faltan permisos');
  });
});
