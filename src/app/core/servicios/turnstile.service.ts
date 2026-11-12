import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

const SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Lo que usamos de la API de Cloudflare Turnstile (`window.turnstile`). */
export interface ApiTurnstile {
  render(
    el: HTMLElement,
    opciones: {
      sitekey: string;
      theme?: 'auto' | 'light' | 'dark';
      language?: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

/** Qué hacer cuando el widget entrega, vence o no logra el token. */
export interface EventosTurnstile {
  token: (token: string) => void;
  vencido: () => void;
  error: () => void;
}

/**
 * Cloudflare Turnstile (anti-bots) para el formulario de asesoría. Carga el
 * script una sola vez y solo en el navegador; en el servidor (SSR) no hace
 * nada.
 */
@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private readonly documento = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private carga: Promise<ApiTurnstile> | null = null;

  /** Inyecta el script (una vez) y espera a que exista `window.turnstile`. */
  cargar(): Promise<ApiTurnstile> {
    if (!this.navegador) {
      return Promise.reject(new Error('Turnstile solo corre en el navegador'));
    }
    this.carga ??= new Promise<ApiTurnstile>((resolver, rechazar) => {
      const ventana = this.documento.defaultView as
        | (Window & { turnstile?: ApiTurnstile })
        | null;
      if (ventana?.turnstile) return resolver(ventana.turnstile);
      const script = this.documento.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        ventana?.turnstile
          ? resolver(ventana.turnstile)
          : rechazar(new Error('Turnstile no quedó disponible'));
      script.onerror = () => {
        this.carga = null; // Se puede volver a intentar.
        script.remove();
        rechazar(new Error('No cargó el script de Turnstile'));
      };
      this.documento.head.appendChild(script);
    });
    return this.carga;
  }

  /** Muestra el widget en `el` y devuelve su id. */
  async mostrar(el: HTMLElement, eventos: EventosTurnstile): Promise<string> {
    const turnstile = await this.cargar();
    const id = turnstile.render(el, {
      sitekey: environment.turnstileSiteKey,
      theme: 'auto',
      language: 'es',
      callback: eventos.token,
      'expired-callback': eventos.vencido,
      'error-callback': eventos.error,
    });
    if (!id) throw new Error('Turnstile no mostró el widget');
    return id;
  }

  /** Pide un token nuevo (cada token sirve una sola vez). */
  reiniciar(id: string): void {
    void this.cargar().then((t) => t.reset(id));
  }

  quitar(id: string): void {
    void this.cargar().then((t) => t.remove(id));
  }
}
