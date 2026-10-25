/** Convierte una tasa efectiva anual en porcentaje (23.28) a tasa mensual en fracción. */
export function tasaMensual(efectivaAnual: number): number {
  return Math.pow(1 + efectivaAnual / 100, 1 / 12) - 1;
}

/** Cuota fija mensual (sistema francés): C = P·i / (1 − (1 + i)^−n). */
export function cuotaMensual(
  monto: number,
  efectivaAnual: number,
  meses: number,
): number {
  if (monto <= 0 || meses <= 0 || efectivaAnual < 0) return 0;
  const i = tasaMensual(efectivaAnual);
  if (i === 0) return monto / meses;
  return (monto * i) / (1 - Math.pow(1 + i, -meses));
}

export interface CuotaAmortizacion {
  mes: number;
  cuota: number;
  interes: number;
  /** Lo que la cuota baja de la deuda. */
  capital: number;
  /** Lo que se debe después de pagar esta cuota. */
  saldo: number;
}

/**
 * Cómo se reparte la deuda en las cuotas:
 * - `fija` (sistema francés): la misma cuota todos los meses.
 * - `decreciente` (abono constante a capital): el mismo abono a capital cada
 *   mes más los intereses del saldo, así que la cuota baja mes a mes.
 */
export type SistemaAmortizacion = 'fija' | 'decreciente';

/**
 * Tabla de amortización: en cada mes el interés sale del saldo y el resto de
 * la cuota abona a capital. El último mes cierra el saldo en cero.
 */
export function amortizacion(
  monto: number,
  efectivaAnual: number,
  meses: number,
  sistema: SistemaAmortizacion = 'fija',
): CuotaAmortizacion[] {
  const cuota = cuotaMensual(monto, efectivaAnual, meses);
  if (cuota <= 0) return [];
  const i = tasaMensual(efectivaAnual);
  const filas: CuotaAmortizacion[] = [];
  let saldo = monto;
  for (let mes = 1; mes <= meses; mes++) {
    const interes = saldo * i;
    const abono = sistema === 'fija' ? cuota - interes : monto / meses;
    const capital = mes === meses ? saldo : abono;
    saldo = mes === meses ? 0 : saldo - capital;
    filas.push({ mes, cuota: capital + interes, interes, capital, saldo });
  }
  return filas;
}

export interface Ahorro {
  /** Diferencia de cuota al mes (positiva si la mejor tasa sale más barata). */
  mes: number;
  /** Diferencia en todo el crédito. */
  total: number;
}

/** Cuánto se ahorra al cambiar la tasa ofrecida por la mejor del ranking. */
export function ahorro(
  monto: number,
  tasaOfrecida: number,
  mejorTasa: number,
  meses: number,
): Ahorro {
  const mes =
    cuotaMensual(monto, tasaOfrecida, meses) -
    cuotaMensual(monto, mejorTasa, meses);
  return { mes, total: mes * meses };
}

/** Lee un número escrito a la colombiana: "20.000.000" o "26,38". */
export function leerNumero(texto: string): number {
  const limpio = String(texto)
    .replace(/[^\d,]/g, '')
    .replace(',', '.');
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : 0;
}

/** Convierte una tasa mensual en porcentaje (2.1) a efectiva anual en porcentaje. */
export function efectivaAnualDeMensual(mensualPorcentaje: number): number {
  return (Math.pow(1 + mensualPorcentaje / 100, 12) - 1) * 100;
}

/**
 * Tasa efectiva anual (en porcentaje) que corresponde a una cuota fija, por
 * búsqueda binaria sobre la tasa mensual. `null` si la cuota no alcanza a
 * pagar el monto en ese plazo (cuota <= monto / meses).
 */
export function tasaDeCuota(
  monto: number,
  cuota: number,
  meses: number,
): number | null {
  if (monto <= 0 || meses <= 0 || cuota <= monto / meses) return null;
  const cuotaCon = (i: number) => (monto * i) / (1 - Math.pow(1 + i, -meses));
  let bajo = 0;
  let alto = 1;
  // Si ni con 100 % mensual se llega a la cuota, la tasa es absurda.
  if (cuotaCon(alto) < cuota) return null;
  for (let k = 0; k < 200; k++) {
    const medio = (bajo + alto) / 2;
    if (cuotaCon(medio) < cuota) bajo = medio;
    else alto = medio;
  }
  return efectivaAnualDeMensual(((bajo + alto) / 2) * 100);
}
