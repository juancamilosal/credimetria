import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DatosFinancieros } from '../modelos/financiero';

/** Datos fijos en lugar de /api/financieros (para las pruebas). */
export const FINANCIEROS_INICIALES = new InjectionToken<DatosFinancieros>(
  'FINANCIEROS_INICIALES',
);

/**
 * Las cifras del CUIF y los análisis de /api/financieros (ver
 * servidor/financieros.mjs). Se piden una sola vez, desde el navegador, y
 * las comparten el inicio y /estados-financieros.
 */
@Injectable({ providedIn: 'root' })
export class FinancierosService {
  // Opcional: en las pruebas los datos llegan por FINANCIEROS_INICIALES.
  private readonly http = inject(HttpClient, { optional: true });
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly iniciales = inject(FINANCIEROS_INICIALES, {
    optional: true,
  });

  readonly datos = signal<DatosFinancieros | null>(this.iniciales ?? null);
  readonly cargando = signal(!this.iniciales);
  readonly sinConexion = signal(false);
  private pedido = !!this.iniciales;

  /** Pide las cifras si todavía no se pidieron (solo en el navegador). */
  cargar(): void {
    if (this.pedido || !this.http || !this.navegador) return;
    this.pedido = true;
    this.http.get<DatosFinancieros>('/api/financieros').subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: () => {
        this.sinConexion.set(true);
        this.cargando.set(false);
      },
    });
  }
}
