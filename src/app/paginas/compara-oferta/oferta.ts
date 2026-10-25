import { Producto, TasaEntidad } from '../../core/modelos/tasa';
import {
  Ahorro,
  ahorro,
  cuotaMensual,
  leerNumero,
  tasaDeCuota,
} from '../../core/utilidades/credito';

/** Lo que el asesor le dijo a la persona. */
export type TipoOferta = 'ea' | 'mv' | 'cuota';

export interface DatosOferta {
  producto: Producto;
  monto: number;
  plazo: number;
  tipo: TipoOferta;
  /** Tasa que le dijeron, ya en efectivo anual (también si era mensual). */
  tasaDicha: number | null;
  /** La tasa mensual tal como se la dijeron, si fue mensual. */
  tasaMensualDicha: number | null;
  /** Cuota mensual que le dijeron, con seguros incluidos. */
  cuota: number | null;
}

export type Veredicto = 'usura' | 'alto' | 'bien';

export interface ResultadoOferta {
  /** Tasa efectiva anual que de verdad paga: la de la cuota si la dio. */
  tasaReal: number;
  /** `true` si la tasa real salió de la cuota. */
  conCuota: boolean;
  cuota: number;
  total: number;
  /** Cuota que corresponde a la tasa que le dijeron, sin costos extra. */
  cuotaTeorica: number | null;
  /** Lo que la cuota tiene de más frente a la tasa dicha (seguros, comisiones). */
  costosMes: number;
  mejor: TasaEntidad | undefined;
  /** Ahorro frente a la mejor entidad; `null` si no hay mejor entidad. */
  ahorro: Ahorro | null;
  veredicto: Veredicto;
}

/**
 * Calcula el resultado de una oferta. `usura` es la tasa de usura que aplica
 * al producto, o `null` si no aplica.
 */
export function calcularOferta(
  datos: DatosOferta,
  mejor: TasaEntidad | undefined,
  usura: number | null,
): ResultadoOferta {
  const { monto, plazo, cuota, tasaDicha } = datos;
  const deCuota = cuota !== null ? tasaDeCuota(monto, cuota, plazo) : null;
  const tasaReal = deCuota ?? tasaDicha ?? 0;
  const cuotaReal = cuota ?? cuotaMensual(monto, tasaReal, plazo);
  const cuotaTeorica =
    tasaDicha !== null ? cuotaMensual(monto, tasaDicha, plazo) : null;
  const extra =
    cuota !== null && cuotaTeorica !== null ? cuota - cuotaTeorica : 0;
  const ahorroMejor = mejor
    ? ahorro(monto, tasaReal, mejor.tasaReal, plazo)
    : null;

  let veredicto: Veredicto = 'bien';
  if (usura !== null && tasaReal > usura) veredicto = 'usura';
  else if (ahorroMejor && ahorroMejor.mes > 1) veredicto = 'alto';

  return {
    tasaReal,
    conCuota: deCuota !== null,
    cuota: cuotaReal,
    total: cuotaReal * plazo,
    cuotaTeorica,
    costosMes: extra > 1 ? extra : 0,
    mejor,
    ahorro: ahorroMejor,
    veredicto,
  };
}

/**
 * Lee una tasa escrita como "26,38", "26.38" o "26,38 %". A diferencia de
 * `leerNumero`, un solo punto se toma como decimal.
 */
export function leerTasa(texto: string): number {
  const limpio = String(texto).replace(/[%\s]/g, '');
  if (!limpio.includes(',') && /^\d+\.\d+$/.test(limpio)) return Number(limpio);
  return leerNumero(limpio);
}
