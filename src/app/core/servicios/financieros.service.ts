import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
  InjectionToken,
  makeStateKey,
  PendingTasks,
  PLATFORM_ID,
  signal,
  TransferState,
} from '@angular/core';
import { DatosFinancieros } from '../modelos/financiero';

/** Datos fijos en lugar de /api/financieros (para las pruebas). */
export const FINANCIEROS_INICIALES = new InjectionToken<DatosFinancieros>(
  'FINANCIEROS_INICIALES',
);

/** En el servidor, lee las cifras directo (sin pasar por /api/financieros). */
export const CARGADOR_FINANCIEROS = new InjectionToken<
  () => Promise<DatosFinancieros>
>('CARGADOR_FINANCIEROS');

const CLAVE = makeStateKey<DatosFinancieros>('credimetria-financieros');

/** Si el CUIF tarda más que esto, el servidor arma la página sin cifras. */
const ESPERA_SERVIDOR_MS = 8000;

/**
 * Las cifras del CUIF y los análisis (ver servidor/financieros.mjs), que
 * comparten el inicio y /estados-financieros.
 *
 * /estados-financieros las pide con `cargar(true)`: el servidor las lee y
 * llegan dentro de la página ya armada, así Google ve las cifras (no puede
 * pedir /api/, que robots.txt le cierra; sin ellas veía "Cargando las
 * cifras…" y la marcaba como página vacía, "Soft 404"). El inicio, con
 * `cargar()`, las pide desde el navegador para no cargar la página.
 */
@Injectable({ providedIn: 'root' })
export class FinancierosService {
  // Opcional: en las pruebas los datos llegan por FINANCIEROS_INICIALES.
  private readonly http = inject(HttpClient, { optional: true });
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly iniciales = inject(FINANCIEROS_INICIALES, {
    optional: true,
  });
  private readonly cargador = inject(CARGADOR_FINANCIEROS, { optional: true });
  private readonly estado = inject(TransferState);
  private readonly pendientes = inject(PendingTasks);

  readonly datos = signal<DatosFinancieros | null>(this.iniciales ?? null);
  readonly cargando = signal(!this.iniciales);
  readonly sinConexion = signal(false);
  private pedido = !!this.iniciales;

  /**
   * Pide las cifras si todavía no se pidieron. Con `enServidor`, también al
   * armar la página en el servidor (que espera a tenerlas).
   */
  cargar(enServidor = false): void {
    if (this.pedido) return;
    if (this.navegador) {
      const ya = this.estado.get(CLAVE, null);
      if (ya) {
        this.estado.remove(CLAVE);
        this.pedido = true;
        this.listo(ya);
        return;
      }
      if (!this.http) return;
      this.pedido = true;
      this.http.get<DatosFinancieros>('/api/financieros').subscribe({
        next: (d) => this.listo(d),
        error: () => this.fallo(),
      });
      return;
    }
    if (!enServidor || !this.cargador) return;
    this.pedido = true;
    const terminar = this.pendientes.add();
    let espera: ReturnType<typeof setTimeout> | undefined;
    Promise.race([
      this.cargador(),
      new Promise<never>((_, no) => {
        espera = setTimeout(
          () => no(new Error('El CUIF tardó')),
          ESPERA_SERVIDOR_MS,
        );
      }),
    ])
      .then((d) => {
        this.estado.set(CLAVE, d);
        this.listo(d);
      })
      // Sin cifras en el servidor, el navegador las vuelve a pedir.
      .catch(() => (this.pedido = false))
      .finally(() => {
        clearTimeout(espera);
        terminar();
      });
  }

  private listo(d: DatosFinancieros): void {
    this.datos.set(d);
    this.sinConexion.set(false);
    this.cargando.set(false);
  }

  private fallo(): void {
    this.sinConexion.set(true);
    this.cargando.set(false);
  }
}
