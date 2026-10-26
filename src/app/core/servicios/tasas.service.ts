import { HttpClient } from '@angular/common/http';
import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  makeStateKey,
  signal,
  TransferState,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PRODUCTOS } from '../datos/tasas';
import {
  CorteTasas,
  InfoProducto,
  Producto,
  TasaEntidad,
  TipoEntidad,
} from '../modelos/tasa';

/** Tasas fijas en lugar de las de Directus (para las pruebas). */
export const TASAS_INICIALES = new InjectionToken<{
  tasas: TasaEntidad[];
  corte: CorteTasas;
}>('TASAS_INICIALES');

/** Lo que devuelve /api/tasas (ver servidor/tasas.mjs). */
export interface DatosTasas {
  corte: CorteTasas;
  tasas: TasaEntidad[];
}

/**
 * En el servidor, función que lee las tasas de Directus directamente; en el
 * navegador no existe y se piden a /api/tasas.
 */
export const CARGADOR_TASAS = new InjectionToken<() => Promise<DatosTasas>>(
  'CARGADOR_TASAS',
);

const CLAVE_TASAS = makeStateKey<DatosTasas>('credimetria-tasas');

/**
 * Punto único de acceso a las tasas: las publicadas (rango del PDF de cada
 * entidad, ya aprobado) y lo que cobra cada una en promedio según la
 * Superfinanciera. La cuota y el orden se calculan con el promedio. Las lee
 * el servidor de la página (Directus nunca se llama desde el navegador) y
 * pasan al navegador dentro de la página ya armada.
 */
@Injectable({ providedIn: 'root' })
export class TasasService {
  // Opcional: en las pruebas las tasas llegan por TASAS_INICIALES.
  private readonly http = inject(HttpClient, { optional: true });
  private readonly cargador = inject(CARGADOR_TASAS, { optional: true });
  private readonly estado = inject(TransferState);
  private readonly iniciales = inject(TASAS_INICIALES, { optional: true });

  private readonly todas = signal<TasaEntidad[]>(this.iniciales?.tasas ?? []);
  readonly corte = signal<CorteTasas>(
    this.iniciales?.corte ?? {
      fuente: 'Superintendencia Financiera de Colombia',
      fecha: null,
      ejemplo: false,
    },
  );
  /** Todavía se están trayendo las tasas (la tabla muestra el esqueleto). */
  readonly cargando = signal(!this.iniciales);
  /** No se pudieron leer las tasas. */
  readonly sinConexion = signal(false);

  readonly productos: InfoProducto[] = PRODUCTOS;
  readonly tipos: TipoEntidad[] = ['Banco', 'Cooperativa', 'Financiera'];

  /** Nombres de todas las entidades que comparamos, en orden alfabético. */
  readonly listaEntidades = computed(() =>
    [...new Set(this.todas().map((t) => t.entidad))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    ),
  );

  /**
   * Trae las tasas: en el servidor, de Directus (con su caché); en el
   * navegador, de la página ya armada o, si no vienen, de /api/tasas. Si
   * fallan, la página queda sin tasas y `sinConexion` lo dice.
   */
  async cargar(): Promise<void> {
    if (this.iniciales) return;
    try {
      let datos = this.estado.get(CLAVE_TASAS, null);
      if (datos) {
        this.estado.remove(CLAVE_TASAS);
      } else if (this.cargador) {
        datos = await this.cargador();
        this.estado.set(CLAVE_TASAS, datos);
      } else {
        if (!this.http) throw new Error('Sin HttpClient');
        datos = await firstValueFrom(this.http.get<DatosTasas>('/api/tasas'));
      }
      this.todas.set(datos.tasas);
      this.corte.set(datos.corte);
      this.sinConexion.set(false);
    } catch {
      this.sinConexion.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Entidades de un producto ordenadas por la tasa que cobran, de menor a
   * mayor. El orden nunca depende de quién paga publicidad.
   */
  ranking(producto: Producto, tipo: TipoEntidad | null = null): TasaEntidad[] {
    return this.todas()
      .filter(
        (t) => t.producto === producto && (tipo === null || t.tipo === tipo),
      )
      .sort((a, b) => a.tasaReal - b.tasaReal);
  }

  /** La entidad que menos cobra para un producto. */
  mejor(producto: Producto): TasaEntidad | undefined {
    return this.ranking(producto)[0];
  }

  /** Nombres de todas las entidades que comparamos, en orden alfabético. */
  entidades(): string[] {
    return this.listaEntidades();
  }

  nombre(producto: Producto): string {
    return this.productos.find((p) => p.id === producto)?.nombre ?? producto;
  }

  esProducto(valor: unknown): valor is Producto {
    return this.productos.some((p) => p.id === valor);
  }
}
