# Changelog

## [1.0.0] — 2026-06-24

### Added

- Suite completa de tests unitarios en el backend (solapamiento, GoogleService, cifrado, guards, BookingsService).
- Tests de integración HTTP con Postgres real (Testcontainers localmente, servicio Postgres en CI).
- Test de concurrencia para creación simultánea de bookings (constraint `EXCLUDE` de Postgres).
- Test E2E con Playwright cubriendo login → dashboard → crear reserva → listar → cancelar.
- Workflow de CI con cobertura mínima configurada (Jest `--coverage` con umbrales por módulo).
- `docker-compose.prod.yml` para despliegue en producción (Postgres sin puerto expuesto al host, límites de recursos).
- Dockerfiles multi-stage optimizados con usuario no-root en API y Web.

### Documented

- README ampliado con arquitectura, diagramas, guía de tests y variables de entorno.
- Sección de decisiones de diseño consolidada.

---

## Mejoras futuras (pendientes)

| Área | Descripción |
| ---- | ----------- |
| **Webhooks de Google Calendar** | Sincronización en tiempo real cuando cambian eventos externos, en lugar de consultar `freebusy` solo al crear reservas. |
| **Multi-calendario** | Permitir al usuario elegir qué calendarios de Google incluir en la verificación de conflictos. |
| **Notificaciones por email** | Recordatorios y confirmaciones de reserva vía SendGrid, Resend u otro proveedor. |
| **OpenAPI / Swagger** | Documentación interactiva de la API REST. |
| **Observabilidad** | Métricas (Prometheus), tracing distribuido y alertas sobre fallos de Google Calendar. |
| **Tests E2E contra stack real** | Ejecutar Playwright contra API + Postgres reales en CI (además del mock actual de BFF). |
| **Reverse proxy / TLS** | Nginx o Traefik delante de `web` y `api` con certificados automáticos (Let's Encrypt). |
| **Refresh token rotation** | Rotación proactiva de tokens de Google antes de expiración para reducir reconexiones. |
