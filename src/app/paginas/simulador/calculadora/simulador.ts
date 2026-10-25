import { Component, computed, inject, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  formatoPesos,
  PesosPipe,
  TasaPipe,
} from '../../../compartido/pipes/formato';
import { USURA_CONSUMO } from '../../../core/datos/tasas';
import { Producto } from '../../../core/modelos/tasa';
import { TasasService } from '../../../core/servicios/tasas.service';
import {
  ahorro,
  cuotaMensual,
  leerNumero,
} from '../../../core/utilidades/credito';

/** Productos que se pueden simular (vivienda tiene su propio cálculo). */
const PRODUCTOS_SIMULADOR: Producto[] = [
  'libre-inversion',
  'libranza',
  'compra-cartera',
  'vehiculo',
];

/**
 * La persona escribe la tasa que le ofrecieron y ve al instante su cuota y
 * cuánto se ahorraría con la entidad que cobra menos. Se recalcula al
 * cambiar cualquier campo, sin botón de calcular.
 */
@Component({
  selector: 'app-simulador',
  imports: [RouterLink, PesosPipe, TasaPipe],
  templateUrl: './simulador.html',
  styleUrl: './simulador.css',
})
export class Simulador {
  private readonly tasas = inject(TasasService);

  protected readonly productos = this.tasas.productos.filter((p) =>
    PRODUCTOS_SIMULADOR.includes(p.id),
  );
  protected readonly plazos = [12, 24, 36, 48, 60, 72];

  /** El producto lo comparte con el ranking resumido de la página. */
  readonly producto = model<Producto>('libre-inversion');
  protected readonly montoTexto = signal('20.000.000');
  protected readonly plazo = signal(48);
  protected readonly tasaTexto = signal('26,38');

  protected readonly monto = computed(() => leerNumero(this.montoTexto()));
  protected readonly tasa = computed(() => leerNumero(this.tasaTexto()));
  protected readonly listo = computed(
    () => this.monto() > 0 && this.tasa() > 0,
  );

  protected readonly cuota = computed(() =>
    this.listo() ? cuotaMensual(this.monto(), this.tasa(), this.plazo()) : 0,
  );
  protected readonly mejor = computed(() => this.tasas.mejor(this.producto()));
  protected readonly cuotaMejor = computed(() => {
    const mejor = this.mejor();
    return mejor ? cuotaMensual(this.monto(), mejor.tasaReal, this.plazo()) : 0;
  });
  protected readonly ahorro = computed(() => {
    const mejor = this.mejor();
    return mejor && this.listo()
      ? ahorro(this.monto(), this.tasa(), mejor.tasaReal, this.plazo())
      : null;
  });
  /** La tasa escrita es igual o menor que la mejor del ranking. */
  protected readonly buenaTasa = computed(() => {
    const valor = this.ahorro();
    return valor !== null && valor.mes <= 0.5;
  });
  protected readonly usura = USURA_CONSUMO;
  protected readonly superaUsura = computed(
    () => this.tasa() > USURA_CONSUMO.tasa,
  );

  protected cambiarProducto(valor: string): void {
    if (this.tasas.esProducto(valor)) this.producto.set(valor);
  }

  /** Al salir del campo, el monto queda con puntos de miles. */
  protected formatearMonto(): void {
    if (this.monto() > 0) {
      this.montoTexto.set(formatoPesos(this.monto()).slice(1));
    }
  }
}
