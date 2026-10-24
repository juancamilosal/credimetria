import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Producto } from '../../../core/modelos/tasa';
import { TasasService } from '../../../core/servicios/tasas.service';
import { resumenCredito } from '../../../core/utilidades/credito';

/** Las tres entidades con la tasa real más baja, con pestañas por tipo de crédito. */
@Component({
  selector: 'app-mejores-tasas',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './mejores-tasas.html',
  styleUrl: './mejores-tasas.css',
})
export class MejoresTasas {
  private readonly tasas = inject(TasasService);

  protected readonly productos = this.tasas.productos;
  protected readonly corte = this.tasas.corte;
  protected readonly seleccionado = signal<Producto>('libre-inversion');

  protected readonly info = computed(() =>
    this.tasas.producto(this.seleccionado()),
  );
  protected readonly promedio = computed(() =>
    this.tasas.promedio(this.seleccionado()),
  );

  /** Las 3 mejores, con la cuota de ejemplo y el ahorro frente al promedio del mercado. */
  protected readonly ranking = computed(() => {
    const { montoEjemplo, plazoEjemplo } = this.info();
    const pagoPromedio = resumenCredito(
      montoEjemplo,
      this.promedio(),
      plazoEjemplo,
    ).totalPagado;
    return this.tasas.mejores(this.seleccionado()).map((tasa) => {
      const resumen = resumenCredito(montoEjemplo, tasa.tasaReal, plazoEjemplo);
      return {
        ...tasa,
        cuota: resumen.cuota,
        ahorro: Math.max(0, pagoPromedio - resumen.totalPagado),
      };
    });
  });

  protected seleccionar(producto: Producto): void {
    this.seleccionado.set(producto);
  }
}
