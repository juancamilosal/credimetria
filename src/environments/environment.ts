/** Configuración pública del sitio (producción). */
export const environment = {
  production: true,
  /** Clave pública de Cloudflare Turnstile para el formulario de asesoría. */
  turnstileSiteKey: '0x4AAAAAAF9gr6at7_DWOs35',
  /**
   * Etiqueta de Google (Tag Manager con Google Analytics 4). Solo se carga en
   * credimetria.com y solo si la persona acepta las cookies.
   */
  etiquetaGoogle: 'GTM-NLJW2HG2',
};
