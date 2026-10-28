import usura from './usura.json';
import { InfoProducto, Producto } from '../modelos/tasa';

export const PRODUCTOS: InfoProducto[] = [
  { id: 'libre-inversion', nombre: 'Libre inversión' },
  { id: 'libranza', nombre: 'Libranza' },
  { id: 'compra-cartera', nombre: 'Compra de cartera' },
  { id: 'vehiculo', nombre: 'Vehículo' },
  { id: 'vivienda-vis', nombre: 'Crédito hipotecario VIS' },
  { id: 'vivienda-no-vis', nombre: 'Crédito hipotecario No VIS' },
  { id: 'leasing-vis', nombre: 'Leasing habitacional VIS' },
  { id: 'leasing-no-vis', nombre: 'Leasing habitacional No VIS' },
];

/**
 * Productos de vivienda (crédito hipotecario y leasing habitacional, VIS y
 * No VIS, en pesos). No les aplica la usura de consumo: si la entidad no
 * publica el "hasta", no se muestra.
 */
export const VIVIENDA: Producto[] = [
  'vivienda-vis',
  'vivienda-no-vis',
  'leasing-vis',
  'leasing-no-vis',
];

export const esVivienda = (producto: string): boolean =>
  (VIVIENDA as string[]).includes(producto);

/**
 * Tasa de usura del mes para crédito de consumo ordinario (certificada por
 * la Superfinanciera). Ninguna entidad puede cobrar más. Se actualiza cada
 * mes en `usura.json`, que también lee el robot de los PDF.
 */
export const USURA_CONSUMO: { tasa: number; mv: number; mes: string } = usura;

/**
 * De dónde sale la tasa "Cobra en promedio": el reporte semanal de tasas
 * (formato 88) que las entidades envían a la Superfinanciera, publicado en
 * datos.gov.co. Promediamos las últimas 4 semanas, ponderando por monto.
 */
export const FUENTE_PROMEDIO = {
  texto: 'Superfinanciera en datos.gov.co',
  url: 'https://www.datos.gov.co/Econom-a-y-Finanzas/Tasas-de-inter-s-activas-por-tipo-de-cr-dito-ltimo/qzsc-9esp',
};

/** Explicación de la columna "Diferencia", para quien no la entienda. */
export const AYUDA_DIFERENCIA =
  'Es lo que cobra en promedio menos la tasa más baja que anuncia. Ejemplo: si anuncia desde 16 % y cobra en promedio 19,57 %, la diferencia es +3,57 puntos. Mientras más alta, más lejos está lo que anuncia de lo que de verdad cobra. Si es negativa, cobra en promedio menos de lo que anuncia.';
