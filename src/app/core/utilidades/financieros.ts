import { EntidadFinanciera } from '../modelos/financiero';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const numero = (v: number, decimales: number) =>
  v.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

/**
 * Pesos grandes en palabras: "$1,63 billones", "$820.500 millones",
 * "−$41.600 millones" (las pérdidas con signo menos).
 */
export function pesosGrandes(valor: number): string {
  const signo = valor < 0 ? '−' : '';
  const v = Math.abs(valor);
  if (v >= 1e12) return `${signo}$${numero(v / 1e12, 2)} billones`;
  if (v >= 1e6) return `${signo}$${numero(Math.round(v / 1e6), 0)} millones`;
  return `${signo}$${numero(Math.round(v), 0)}`;
}

/** Para la gráfica: "$1,8 bill.", "$853 mil mill.", "$42 mill.". */
export function pesosCortos(valor: number): string {
  const signo = valor < 0 ? '−' : '';
  const v = Math.abs(valor);
  if (v >= 1e12) return `${signo}$${numero(v / 1e12, 1)} bill.`;
  if (v >= 1e9) return `${signo}$${numero(Math.round(v / 1e9), 0)} mil mill.`;
  return `${signo}$${numero(Math.round(v / 1e6), 0)} mill.`;
}

/**
 * Cambio frente al año pasado para las etiquetas: "+59 %", "−1 %". Si el año
 * pasado ganó casi nada el porcentaje se dispara: "+300 % o más".
 */
export function cambio(fraccion: number, corto = false): string {
  const signo = fraccion < 0 ? '−' : '+';
  const v = Math.abs(fraccion);
  if (v > 3) return `${signo}300 %${corto ? '+' : ' o más'}`;
  return `${signo}${numero(v * 100, 0)} %`;
}

/** 0,1564 → "15,6 %". */
export const porcentaje = (fraccion: number, decimales = 1) =>
  `${numero(fraccion * 100, decimales)} %`;

/** "enero a agosto de 2026" (o "enero de 2026" si va un mes). */
export function periodoDelAnio(corte: string): string {
  const anio = corte.slice(0, 4);
  const mes = MESES[Number(corte.slice(5, 7)) - 1];
  return mes === 'enero' ? `enero de ${anio}` : `enero a ${mes} de ${anio}`;
}

/** "ene–ago" para la barra del año en curso. */
export function mesesCortos(corte: string): string {
  const mes = MESES[Number(corte.slice(5, 7)) - 1].slice(0, 3);
  return mes === 'ene' ? 'ene' : `ene–${mes}`;
}

export type Tendencia = 'mejora' | 'estable' | 'empeora';

export interface PuntoAutomatico {
  tipo: 'fortaleza' | 'alerta' | 'dato';
  texto: string;
}

export interface AnalisisAutomatico {
  titular: string;
  tendencia: Tendencia;
  puntos: PuntoAutomatico[];
}

/** Por debajo de ±5 % la utilidad se considera igual a la del año pasado. */
const UMBRAL = 0.05;

/**
 * Lo que dicen las cifras solas: si gana más o menos que el año pasado, si
 * presta más, su rentabilidad y los años con pérdidas. No opina ni
 * recomienda: el análisis escrito de Directus va aparte.
 */
export function analisisAutomatico(e: EntidadFinanciera): AnalisisAutomatico {
  const a = e.actual;
  const periodo = periodoDelAnio(a.corte);
  const antes = a.utilidadAnterior;
  const v = a.variacionUtilidad;

  let titular: string;
  let tendencia: Tendencia;
  if (a.utilidad < 0) {
    const menores = antes !== null && antes < 0 && a.utilidad > antes;
    titular = menores
      ? 'Sigue con pérdidas, pero menores que el año pasado'
      : 'Lleva pérdidas este año';
    tendencia = menores ? 'estable' : 'empeora';
  } else if (antes !== null && antes < 0) {
    titular = 'Pasó de pérdidas a ganancias';
    tendencia = 'mejora';
  } else if (v === null) {
    titular = `Ganó ${pesosGrandes(a.utilidad)} este año`;
    tendencia = 'estable';
  } else if (v >= UMBRAL) {
    titular = `Ganó ${porcentaje(v, 0)} más que el año pasado`;
    tendencia = 'mejora';
  } else if (v <= -UMBRAL) {
    titular = `Ganó ${porcentaje(-v, 0)} menos que el año pasado`;
    tendencia = 'empeora';
  } else {
    titular = 'Ganó casi lo mismo que el año pasado';
    tendencia = 'estable';
  }

  const puntos: PuntoAutomatico[] = [
    {
      tipo: a.utilidad < 0 ? 'alerta' : 'dato',
      texto:
        `${a.utilidad < 0 ? 'Pérdida' : 'Utilidad'} de ${periodo}: ${pesosGrandes(a.utilidad)}` +
        (antes !== null ? ` (el año pasado, ${pesosGrandes(antes)})` : ''),
    },
  ];
  if (
    a.variacionCartera !== null &&
    a.cartera !== null &&
    a.carteraAnterior !== null
  ) {
    const sube = a.variacionCartera >= 0;
    puntos.push({
      tipo: sube ? 'fortaleza' : 'alerta',
      texto:
        `Prestó ${porcentaje(Math.abs(a.variacionCartera), 0)} ${sube ? 'más' : 'menos'}: ` +
        `su cartera pasó de ${pesosGrandes(a.carteraAnterior)} a ${pesosGrandes(a.cartera)}`,
    });
  }
  if (a.rentabilidad !== null) {
    const r = a.rentabilidad;
    puntos.push({
      tipo: r >= 0.12 ? 'fortaleza' : r < 0.05 ? 'alerta' : 'dato',
      texto:
        r < 0
          ? `Rentabilidad negativa: pierde ${porcentaje(-r)} al año sobre su patrimonio`
          : `Rentabilidad de ${porcentaje(r)} al año sobre su patrimonio` +
            (r < 0.05 ? ' (baja)' : ''),
    });
  }
  const perdidas = e.anual.filter((x) => x.utilidad < 0).map((x) => x.anio);
  if (perdidas.length) {
    const lista =
      perdidas.length === 1
        ? String(perdidas[0])
        : `${perdidas.slice(0, -1).join(', ')} y ${perdidas.at(-1)}`;
    puntos.push({ tipo: 'alerta', texto: `Tuvo pérdidas en ${lista}` });
  }
  return { titular, tendencia, puntos };
}
