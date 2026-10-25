import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Producto, TasaEntidad } from '../../core/modelos/tasa';
import { cuotaMensual } from '../../core/utilidades/credito';
import { PesosPipe, PuntosPipe, TasaPipe } from '../pipes/formato';

/** Monto y plazo con los que se calcula la cuota estimada si no llegan otros. */
export const MONTO_RANKING = 20_000_000;
export const PLAZO_RANKING = 48;

/** Valor del filtro de tipo que muestra todas las entidades. */
export const TODAS = 'Todas';

export type ColumnaRanking =
  | 'entidad'
  | 'tipo'
  | 'tasaAnunciada'
  | 'tasaReal'
  | 'diferencia'
  | 'cuota';

export interface OrdenRanking {
  columna: ColumnaRanking;
  dir: 'asc' | 'desc';
}

/** Orden por defecto: de la tasa real más baja a la más alta. */
export const ORDEN_REAL: OrdenRanking = { columna: 'tasaReal', dir: 'asc' };

interface FilaVista extends TasaEntidad {
  /** Puesto por tasa real, sin importar cómo esté ordenada la tabla. */
  puesto: number;
  diferencia: number | null;
  cuota: number;
}

/**
 * Entidades por tasa real: tabla en escritorio y tarjetas en celular. Con
 * `completa` agrega la cuota estimada y el enlace "Quiero esta". Con
 * `ordenable`, cada título ordena la tabla al tocarlo (como en Excel) y el
 * título "Tipo" filtra por tipo de entidad.
 */
@Component({
  selector: 'app-tabla-ranking',
  imports: [RouterLink, PesosPipe, PuntosPipe, TasaPipe],
  templateUrl: './tabla-ranking.html',
  styleUrl: './tabla-ranking.css',
  host: {
    '(document:click)': 'cerrarMenuSiAfuera($event)',
    '(document:keydown.escape)': 'menuTipo.set(false)',
  },
})
export class TablaRanking {
  private readonly elemento = inject(ElementRef<HTMLElement>);

  /** Filas ya ordenadas por tasa real (de ahí sale el puesto). */
  readonly filas = input.required<TasaEntidad[]>();
  readonly producto = input.required<Producto>();
  readonly titulo = input<string | null>(null);
  readonly completa = input(false);
  /** Etiqueta verde en el puesto 1; solo si la lista no está filtrada. */
  readonly marcarMejor = input(true);
  readonly monto = input(MONTO_RANKING);
  readonly plazo = input(PLAZO_RANKING);
  readonly ordenable = input(false);
  readonly orden = model<OrdenRanking>(ORDEN_REAL);
  /** Tipos para el filtro del título "Tipo"; vacío si no se filtra. */
  readonly tipos = input<string[]>([]);
  readonly tipo = model<string>(TODAS);

  protected readonly menuTipo = signal(false);
  protected readonly todas = TODAS;

  protected readonly vista = computed<FilaVista[]>(() => {
    const filas = this.filas().map((t, i) => ({
      ...t,
      puesto: i + 1,
      diferencia:
        t.tasaAnunciada === null ? null : t.tasaReal - t.tasaAnunciada,
      cuota: cuotaMensual(this.monto(), t.tasaReal, this.plazo()),
    }));
    if (!this.ordenable()) return filas;
    const { columna, dir } = this.orden();
    const signo = dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const x = a[columna];
      const y = b[columna];
      // Los vacíos ("—") van siempre al final.
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      const comparacion =
        typeof x === 'string'
          ? x.localeCompare(y as string, 'es')
          : x - (y as number);
      return comparacion * signo || a.puesto - b.puesto;
    });
  });

  protected ordenar(columna: ColumnaRanking): void {
    const actual = this.orden();
    this.orden.set(
      actual.columna === columna
        ? { columna, dir: actual.dir === 'asc' ? 'desc' : 'asc' }
        : { columna, dir: 'asc' },
    );
  }

  protected ariaSort(columna: ColumnaRanking): string {
    const { columna: actual, dir } = this.orden();
    if (actual !== columna) return 'none';
    return dir === 'asc' ? 'ascending' : 'descending';
  }

  protected flecha(columna: ColumnaRanking): string {
    const { columna: actual, dir } = this.orden();
    if (actual !== columna) return '↕';
    return dir === 'asc' ? '↑' : '↓';
  }

  protected elegirTipo(tipo: string): void {
    this.tipo.set(tipo);
    this.menuTipo.set(false);
  }

  protected cerrarMenuSiAfuera(evento: Event): void {
    if (!this.menuTipo()) return;
    const menu = (this.elemento.nativeElement as HTMLElement).querySelector(
      '.filtro-tipo',
    );
    if (menu && !menu.contains(evento.target as Node)) this.menuTipo.set(false);
  }
}
