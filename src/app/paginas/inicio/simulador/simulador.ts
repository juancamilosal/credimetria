import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { TasasService } from '../../../core/servicios/tasas.service';
import { resumenCredito, tasaMensual } from '../../../core/utilidades/credito';

/** Calculadora rápida de cuota: monto, plazo y la tasa que le ofrecieron al usuario. */
@Component({
  selector: 'app-simulador',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './simulador.html',
  styleUrl: './simulador.css',
})
export class Simulador {
  private readonly tasas = inject(TasasService);

  protected readonly plazos = [12, 24, 36, 48, 60, 72];
  protected readonly monto = signal(20_000_000);
  protected readonly plazo = signal(48);
  protected readonly tasa = signal(
    Number(this.tasas.promedio('libre-inversion').toFixed(2)),
  );

  protected readonly resumen = computed(() =>
    resumenCredito(this.monto(), this.tasa(), this.plazo()),
  );
  protected readonly tasaMes = computed(() => tasaMensual(this.tasa()) * 100);

  protected cambiarMonto(valor: string): void {
    this.monto.set(
      this.limitar(Number(valor.replace(/\D/g, '')), 0, 2_000_000_000),
    );
  }

  protected cambiarPlazo(valor: string): void {
    this.plazo.set(Number(valor));
  }

  protected cambiarTasa(valor: string): void {
    this.tasa.set(this.limitar(Number(valor.replace(',', '.')), 0, 100));
  }

  private limitar(valor: number, minimo: number, maximo: number): number {
    if (!Number.isFinite(valor)) return minimo;
    return Math.min(maximo, Math.max(minimo, valor));
  }
}
