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
