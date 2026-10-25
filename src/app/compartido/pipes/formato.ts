import { Pipe, PipeTransform } from '@angular/core';

const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 20000000 → "$20.000.000". */
export function formatoPesos(valor: number): string {
  return '$' + PESOS.format(Math.round(valor));
}

/** 21.48 → "21,48 %"; sin dato → "—". */
export function formatoTasa(valor: number | null | undefined): string {
  return valor == null ? '—' : DECIMAL.format(valor) + ' %';
}

@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(valor: number): string {
    return formatoPesos(valor);
  }
}

@Pipe({ name: 'tasa' })
export class TasaPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatoTasa(valor);
  }
}

/** Diferencia en puntos entre dos tasas: "+7,38 pts". */
@Pipe({ name: 'puntos' })
export class PuntosPipe implements PipeTransform {
  transform(valor: number): string {
    return (valor >= 0 ? '+' : '−') + DECIMAL.format(Math.abs(valor)) + ' pts';
  }
}
