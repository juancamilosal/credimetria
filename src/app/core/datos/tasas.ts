import { InfoProducto } from '../modelos/tasa';

export const PRODUCTOS: InfoProducto[] = [
  { id: 'libre-inversion', nombre: 'Libre inversión' },
  { id: 'libranza', nombre: 'Libranza' },
  { id: 'compra-cartera', nombre: 'Compra de cartera' },
  { id: 'vehiculo', nombre: 'Vehículo' },
  { id: 'vivienda', nombre: 'Vivienda' },
];

/**
 * Tasa de usura de octubre de 2026 para crédito de consumo ordinario
 * (certificada por la Superfinanciera). Ninguna entidad puede cobrar más.
 * Se actualiza cada mes.
 */
export const USURA_CONSUMO = { tasa: 28.59, mes: 'octubre de 2026' };

/**
 * De dónde sale la tasa "Cobra en promedio": el reporte semanal de tasas
 * (formato 88) que las entidades envían a la Superfinanciera, publicado en
 * datos.gov.co. Promediamos las últimas 4 semanas, ponderando por monto.
 */
export const FUENTE_PROMEDIO = {
  texto: 'Superfinanciera en datos.gov.co',
  url: 'https://www.datos.gov.co/Econom-a-y-Finanzas/Tasas-de-inter-s-activas-por-tipo-de-cr-dito-ltimo/qzsc-9esp',
};
