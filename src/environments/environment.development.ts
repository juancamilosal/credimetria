/**
 * Configuración pública para `ng serve`. Para probar Turnstile sin el dominio
 * se puede usar la clave de prueba de Cloudflare 1x00000000000000000000AA.
 */
export const environment = {
  production: false,
  /** Clave pública de Cloudflare Turnstile para el formulario de asesoría. */
  turnstileSiteKey: '0x4AAAAAAF9gr6at7_DWOs35',
};
