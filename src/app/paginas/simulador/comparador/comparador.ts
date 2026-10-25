import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { PesosPipe, TasaPipe } from '../../../compartido/pipes/formato';
import { Producto } from '../../../core/modelos/tasa';
import { TasasService } from '../../../core/servicios/tasas.service';
import { ahorro, cuotaMensual } from '../../../core/utilidades/credito';

/**
 * Compara dos entidades del mismo producto con el monto y el plazo del
 * simulador, usando la tasa que cada una cobra en promedio.
 */
@Component({
  selector: 'app-comparador',
  imports: [PesosPipe, TasaPipe],
  templateUrl: './comparador.html',
  styleUrl: './comparador.css',
})
export class Comparador {
  private readonly tasas = inject(TasasService);

  readonly producto = input.required<Producto>();
  readonly monto = input.required<number>();
  readonly plazo = input.required<number>();

  protected readonly entidades = computed(() =>
    this.tasas.ranking(this.producto()),
  );
  protected readonly nombreProducto = computed(() =>
    this.tasas.nombre(this.producto()),
  );

  /** Al cambiar de producto, A arranca en la que más cobra y B en la que menos. */
  readonly entidadA = linkedSignal(
    () => this.entidades().at(-1)?.entidad ?? '',
  );
  readonly entidadB = linkedSignal(() => this.entidades()[0]?.entidad ?? '');

  protected readonly a = computed(() => this.lado(this.entidadA()));
  protected readonly b = computed(() => this.lado(this.entidadB()));

  /** Positivo si B sale más barata que A. */
  protected readonly diferencia = computed(() => {
    const a = this.a();
    const b = this.b();
    if (!a || !b || this.monto() <= 0) return null;
    return ahorro(this.monto(), a.tasaReal, b.tasaReal, this.plazo());
  });

  private lado(entidad: string) {
    const tasa = this.entidades().find((t) => t.entidad === entidad);
    if (!tasa) return null;
    return {
      ...tasa,
      cuota: cuotaMensual(this.monto(), tasa.tasaReal, this.plazo()),
    };
  }
}
