import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Solo se mide en el sitio de verdad (no en local ni en pruebas). */
export const HOSTS_ANALITICA = new InjectionToken<string[]>('HOSTS_ANALITICA', {
  factory: () => ['credimetria.com', 'www.credimetria.com'],
});

/** Clave del aviso de cookies que ya no existe (se borra si quedó guardada). */
const CLAVE_VIEJA = 'credimetria-cookies';

type Ventana = Window & { dataLayer?: unknown[] };

/**
 * Google Analytics (por la etiqueta de Google, `environment.etiquetaGoogle`).
 * Desde el 13 nov 2026 cuenta todas las visitas sin preguntar (sin aviso de
 * cookies); la política de datos lo informa. La publicidad queda siempre
 * negada. Los eventos nunca llevan datos personales (ni nombre, ni correo,
 * ni celular).
 */
@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private readonly documento = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly hosts = inject(HOSTS_ANALITICA);
  private cargada = false;

  private get ventana(): Ventana | null {
    return this.documento.defaultView as Ventana | null;
  }

  /** Carga Google Analytics (solo en el navegador y en credimetria.com). */
  iniciar(): void {
    if (!this.navegador) return;
    try {
      this.ventana?.localStorage.removeItem(CLAVE_VIEJA);
    } catch {
      // Sin localStorage: no importa.
    }
    this.cargar();
  }

  /**
   * Evento de Analytics (por ejemplo, una solicitud enviada). Si Analytics no
   * está cargado (local, pruebas), no hace nada. Nunca pasar datos personales.
   */
  evento(nombre: string, datos: Record<string, string | number> = {}): void {
    if (!this.cargada) return;
    this.gtag('event', nombre, datos);
  }

  /**
   * Clic en "Quiero esta" o "Quiero asesoría con reportes": qué entidad y
   * desde qué página (sin datos personales).
   */
  clicQuieroEsta(entidad: string, pagina: string, producto = ''): void {
    this.evento('clic_quiero_esta', { entidad, pagina, producto });
  }

  private gtag(...args: unknown[]): void {
    const w = this.ventana;
    if (!w) return;
    w.dataLayer ??= [];
    // gtag usa el objeto `arguments`, no un arreglo.
    (function gtag(..._: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    })(...args);
  }

  /** Carga la etiqueta de Google una sola vez. */
  private cargar(): void {
    const w = this.ventana;
    const id = environment.etiquetaGoogle;
    if (this.cargada || !w || !id || !this.hosts.includes(w.location.hostname))
      return;
    this.cargada = true;
    // Solo medición: la publicidad queda negada.
    this.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    this.gtag('js', new Date());
    w.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = this.documento.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
    this.documento.head.appendChild(script);
  }
}
