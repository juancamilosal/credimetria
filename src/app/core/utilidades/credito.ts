/** Convierte una tasa efectiva anual en porcentaje (23.28) a tasa mensual en fracción. */
export function tasaMensual(efectivaAnual: number): number {
  return Math.pow(1 + efectivaAnual / 100, 1 / 12) - 1;
}

/** Cuota fija mensual (sistema francés) de un crédito. */
export function cuotaMensual(
  monto: number,
  efectivaAnual: number,
  meses: number,
): number {
  if (monto <= 0 || meses <= 0) return 0;
  const i = tasaMensual(efectivaAnual);
  if (i === 0) return monto / meses;
  return (monto * i) / (1 - Math.pow(1 + i, -meses));
}

export interface ResumenCredito {
  cuota: number;
  totalPagado: number;
  totalIntereses: number;
}

/** Cuota, total pagado e intereses de un crédito de cuota fija. */
export function resumenCredito(
  monto: number,
  efectivaAnual: number,
  meses: number,
): ResumenCredito {
  const cuota = cuotaMensual(monto, efectivaAnual, meses);
  const totalPagado = cuota * meses;
  return {
    cuota,
    totalPagado,
    totalIntereses: Math.max(0, totalPagado - monto),
  };
}
