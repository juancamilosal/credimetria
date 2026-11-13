import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { environment } from '../../../environments/environment';

/** Lo que la persona eligió en el aviso de cookies. */
export type Consentimiento = 'aceptadas' | 'rechazadas';

const CLAVE = 'credimetria-cookies';
/** Solo se mide en el sitio de verdad (no en local ni en pruebas). */
export const HOSTS_ANALITICA = new InjectionToken<string[]>('HOSTS_ANALITICA', {
  factory: () => ['credimetria.com', 'www.credimetria.com'],
});

type Ventana = Window & { dataLayer?: unknown[] };

/**
 * Google Analytics (por la etiqueta de Google, `environment.etiquetaGoogle`)
 * con el modo de consentimiento: nada se carga ni se guarda hasta que la
 * persona acepta las cookies en el aviso. Si las rechaza, no se mide. Los
 * eventos nunca llevan datos personales (ni nombre, ni correo, ni celular).
 */
@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private readonly documento = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly hosts = inject(HOSTS_ANALITICA);
  private cargada = false;

  /** null: todavía no ha elegido (se muestra el aviso). */
  readonly consentimiento = signal<Consentimiento | null>(null);
  /** El aviso se ve (solo en el navegador, sin elección guardada). */
  readonly mostrarAviso = signal(false);

  private get ventana(): Ventana | null {
    return this.documento.defaultView as Ventana | null;
  }

  /** Lee la elección guardada; si aceptó antes, carga Analytics. */
  iniciar(): void {
    if (!this.navegador) return;
    const guardado = this.leer();
    this.consentimiento.set(guardado);
    this.mostrarAviso.set(guardado === null);
    if (guardado === 'aceptadas') this.cargar();
  }

  aceptar(): void {
    this.elegir('aceptadas');
    this.cargar();
    this.gtag('consent', 'update', { analytics_storage: 'granted' });
  }

  rechazar(): void {
    this.elegir('rechazadas');
    this.gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  /** "Preferencias de cookies" del pie: vuelve a mostrar el aviso. */
  cambiarPreferencias(): void {
    if (this.navegador) this.mostrarAviso.set(true);
  }

  /**
   * Evento de Analytics (por ejemplo, una solicitud enviada). Sin
   * consentimiento no hace nada. Nunca pasar datos personales.
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

  private elegir(valor: Consentimiento): void {
    this.consentimiento.set(valor);
    this.mostrarAviso.set(false);
    try {
      this.ventana?.localStorage.setItem(CLAVE, valor);
    } catch {
      // Sin localStorage (modo privado estricto): vale solo esta visita.
    }
  }

  private leer(): Consentimiento | null {
    try {
      const v = this.ventana?.localStorage.getItem(CLAVE);
      return v === 'aceptadas' || v === 'rechazadas' ? v : null;
    } catch {
      return null;
    }
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

  /** Carga la etiqueta de Google una sola vez, ya con el consentimiento. */
  private cargar(): void {
    const w = this.ventana;
    const id = environment.etiquetaGoogle;
    if (this.cargada || !w || !id || !this.hosts.includes(w.location.hostname))
      return;
    this.cargada = true;
    // Sin publicidad: solo medición. Lo demás queda negado.
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
