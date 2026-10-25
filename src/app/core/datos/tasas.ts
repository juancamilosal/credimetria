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
