/** Utilidad de un año completo (cierre de diciembre), en pesos. */
export interface UtilidadAnual {
  anio: number;
  utilidad: number;
}

/**
 * Lo que va del año al último corte del CUIF, frente al mismo corte del año
 * anterior. Valores en pesos; variaciones y rentabilidad como fracción
 * (0,15 = 15 %).
 */
export interface CifrasActuales {
  /** Último corte publicado (AAAA-MM-DD). */
  corte: string;
  /** Meses que lleva el año (8 = enero a agosto). */
  meses: number;
  utilidad: number;
  utilidadAnterior: number | null;
  variacionUtilidad: number | null;
  patrimonio: number | null;
  activos: number | null;
  cartera: number | null;
  carteraAnterior: number | null;
  variacionCartera: number | null;
  /** Utilidad llevada a 12 meses sobre el patrimonio. */
  rentabilidad: number | null;
}

export type TipoPunto = 'fortaleza' | 'alerta';

/** El análisis escrito de Directus (colección `estados_financieros`). */
export interface AnalisisEscrito {
  periodo: string | null;
  titular: string | null;
  puntos: { tipo: TipoPunto; texto: string }[];
  paraTi: string | null;
  /** `/api/estados-financieros/<entidad>/pdf`, o `null` si no hay PDF. */
  pdf: string | null;
  actualizado: string | null;
}

export interface EntidadFinanciera {
  codigo: string;
  nombre: string;
  tipo: string | null;
  logo: string | null;
  anual: UtilidadAnual[];
  actual: CifrasActuales;
  analisis: AnalisisEscrito | null;
}

/** Lo que devuelve /api/financieros (ver servidor/financieros.mjs). */
export interface DatosFinancieros {
  fuente: string;
  consulta: string;
  corte: string | null;
  entidades: EntidadFinanciera[];
}
