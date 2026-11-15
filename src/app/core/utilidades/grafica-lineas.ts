import { EntidadFinanciera, UtilidadAnual } from '../modelos/financiero';
import { pesosCortos, porcentaje } from './financieros';

/** Lo que se compara entre bancos, año por año. */
export type Metrica = 'utilidad' | 'rentabilidad' | 'cartera';

export const METRICAS: { valor: Metrica; texto: string }[] = [
  { valor: 'utilidad', texto: 'Utilidad' },
  { valor: 'rentabilidad', texto: 'Rentabilidad' },
  { valor: 'cartera', texto: 'Cartera (lo que presta)' },
];

/** El valor de un año para la métrica; `null` si no se puede calcular. */
export function valorAnual(a: UtilidadAnual, m: Metrica): number | null {
  if (m === 'utilidad') return a.utilidad;
  if (m === 'cartera') return a.cartera;
  return a.patrimonio && a.patrimonio > 0 ? a.utilidad / a.patrimonio : null;
}

/** Texto de un valor de la métrica: "$1,8 bill." o "15,6 %". */
export function textoMetrica(valor: number, m: Metrica): string {
  if (Math.abs(valor) < 1e-9) return m === 'rentabilidad' ? '0 %' : '$0';
  return m === 'rentabilidad' ? porcentaje(valor) : pesosCortos(valor);
}

export interface PuntoLinea {
  anio: number;
  valor: number;
  x: number;
  y: number;
  texto: string;
}

export interface Linea {
  codigo: string;
  nombre: string;
  /** Trazo SVG; se corta donde falta un año. */
  d: string;
  puntos: PuntoLinea[];
  /** El último valor, para la leyenda. */
  ultimo: PuntoLinea | null;
}

export interface Grafica {
  ancho: number;
  alto: number;
  izquierda: number;
  derecha: number;
  anios: { anio: number; x: number }[];
  marcas: { y: number; texto: string }[];
  /** Altura de la línea del cero (si el rango cruza el cero). */
  cero: number | null;
  lineas: Linea[];
}

/** Medidas del dibujo: ancha en computador, angosta en celular. */
export const TAMANOS = {
  ancha: { ancho: 640, alto: 260 },
  angosta: { ancho: 340, alto: 240 },
};
const MARGEN = { arriba: 14, abajo: 28, izquierda: 78, derecha: 14 };

/**
 * Arma la gráfica de líneas (años completos, cierre de diciembre) de varias
 * entidades para una métrica. El eje Y empieza en cero salvo que haya
 * negativos (pérdidas o rentabilidad negativa).
 */
export function armarGrafica(
  entidades: EntidadFinanciera[],
  m: Metrica,
  tamano: { ancho: number; alto: number } = TAMANOS.ancha,
): Grafica | null {
  const ANCHO = tamano.ancho;
  const ALTO = tamano.alto;
  const anios = [
    ...new Set(entidades.flatMap((e) => e.anual.map((a) => a.anio))),
  ].sort((a, b) => a - b);
  const valores = entidades.flatMap((e) =>
    e.anual.map((a) => valorAnual(a, m)).filter((v): v is number => v !== null),
  );
  if (!anios.length || !valores.length) return null;

  const min = Math.min(0, ...valores);
  let max = Math.max(0, ...valores);
  if (max === min) max = min + 1;
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (anio: number) =>
    MARGEN.izquierda +
    (anios.length === 1
      ? ancho / 2
      : (anios.indexOf(anio) / (anios.length - 1)) * ancho);
  const y = (v: number) => MARGEN.arriba + ((max - v) / (max - min)) * alto;

  const marcas = Array.from({ length: 5 }, (_, i) => {
    const v = max - ((max - min) * i) / 4;
    return { y: y(v), texto: textoMetrica(v, m) };
  });

  const lineas: Linea[] = entidades.map((e) => {
    const porAnio = new Map(e.anual.map((a) => [a.anio, valorAnual(a, m)]));
    const puntos: PuntoLinea[] = [];
    let d = '';
    let seguido = false;
    for (const anio of anios) {
      const v = porAnio.get(anio);
      if (v === null || v === undefined) {
        seguido = false;
        continue;
      }
      const p = {
        anio,
        valor: v,
        x: x(anio),
        y: y(v),
        texto: textoMetrica(v, m),
      };
      puntos.push(p);
      d += `${seguido ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      seguido = true;
    }
    return {
      codigo: e.codigo,
      nombre: e.nombre,
      d: d.trim(),
      puntos,
      ultimo: puntos.at(-1) ?? null,
    };
  });

  return {
    ancho: ANCHO,
    alto: ALTO,
    izquierda: MARGEN.izquierda,
    derecha: ANCHO - MARGEN.derecha,
    anios: anios.map((anio) => ({ anio, x: x(anio) })),
    marcas,
    cero: min < 0 ? y(0) : null,
    lineas,
  };
}
