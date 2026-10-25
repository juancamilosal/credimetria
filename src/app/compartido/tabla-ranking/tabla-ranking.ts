import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Producto, TasaEntidad } from '../../core/modelos/tasa';
import { cuotaMensual } from '../../core/utilidades/credito';
import { PesosPipe, PuntosPipe, TasaPipe } from '../pipes/formato';

/** Monto y plazo con los que se calcula la cuota estimada del ranking. */
export const MONTO_RANKING = 20_000_000;
export const PLAZO_RANKING = 48;

/**
 * Entidades ordenadas por tasa real: tabla en escritorio y tarjetas en
 * celular. Con `completa` agrega la cuota estimada y el enlace "Quiero esta".
 */
@Component({
  selector: 'app-tabla-ranking',
  imports: [RouterLink, PesosPipe, PuntosPipe, TasaPipe],
  templateUrl: './tabla-ranking.html',
  styleUrl: './tabla-ranking.css',
})
export class TablaRanking {
  readonly filas = input.required<TasaEntidad[]>();
  readonly producto = input.required<Producto>();
  readonly titulo = input<string | null>(null);
  readonly completa = input(false);
  /** Etiqueta verde en la primera fila; solo si la lista no está filtrada. */
  readonly marcarMejor = input(true);

  protected readonly vista = computed(() =>
    this.filas().map((t) => ({
      ...t,
      diferencia:
        t.tasaAnunciada === null ? null : t.tasaReal - t.tasaAnunciada,
      cuota: cuotaMensual(MONTO_RANKING, t.tasaReal, PLAZO_RANKING),
    })),
  );
}
