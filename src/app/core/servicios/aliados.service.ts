import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  InjectionToken,
  PendingTasks,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Aliado } from '../modelos/aliado';

/**
 * En el servidor, función que lee los asesores publicados de Directus
 * directamente; en el navegador no existe y se piden a /api/asesores.
 */
export const CARGADOR_ASESORES = new InjectionToken<() => Promise<Aliado[]>>(
  'CARGADOR_ASESORES',
);

const CLAVE = makeStateKey<Aliado[]>('credimetria-asesores');

/**
 * Asesores aliados publicados, de la colección `asesores` de Directus. Los
 * lee el servidor de la página y pasan al navegador dentro de la página ya
 * armada (Directus nunca se llama desde el navegador).
 */
@Injectable({ providedIn: 'root' })
export class AliadosService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly cargador = inject(CARGADOR_ASESORES, { optional: true });
  private readonly estado = inject(TransferState);
  private readonly pendientes = inject(PendingTasks);
  private carga: Promise<void> | null = null;

  readonly aliados = signal<Aliado[]>([]);
  readonly cargando = signal(true);
  /** No se pudieron leer los asesores. */
  readonly sinConexion = signal(false);

  /** Trae los asesores una vez; el servidor espera antes de armar la página. */
  cargar(): Promise<void> {
    if (!this.carga) {
      const listo = this.pendientes.add();
      this.carga = this.traer().finally(listo);
    }
    return this.carga;
  }

  private async traer(): Promise<void> {
    try {
      let lista = this.estado.get(CLAVE, null);
      if (lista) {
        this.estado.remove(CLAVE);
      } else if (this.cargador) {
        lista = await this.cargador();
        this.estado.set(CLAVE, lista);
      } else {
        if (!this.http) throw new Error('Sin HttpClient');
        lista = (
          await firstValueFrom(
            this.http.get<{ asesores: Aliado[] }>('/api/asesores'),
          )
        ).asesores;
      }
      this.aliados.set(lista);
      this.sinConexion.set(false);
    } catch {
      this.sinConexion.set(true);
      this.carga = null; // Se puede volver a intentar.
    } finally {
      this.cargando.set(false);
    }
  }
}
