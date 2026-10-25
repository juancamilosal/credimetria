import { CorteTasas, InfoProducto, TasaEntidad } from '../modelos/tasa';

/*
 * Tasas de ejemplo mientras se construye la Fase 1 (recolector de
 * datos.gov.co con historial en la base de datos). AV Villas y Banco de
 * Bogotá en libre inversión son las cifras del documento de la idea; el
 * resto son ilustrativas. Cuando llegue la base de datos, este archivo se
 * reemplaza y `ejemplo` pasa a `false`.
 */

export const CORTE_TASAS: CorteTasas = {
  fuente: 'Superintendencia Financiera de Colombia',
  fecha: '2026-10-09',
  ejemplo: true,
};

export const PRODUCTOS: InfoProducto[] = [
  { id: 'libre-inversion', nombre: 'Libre inversión' },
  { id: 'libranza', nombre: 'Libranza' },
  { id: 'compra-cartera', nombre: 'Compra de cartera' },
  { id: 'vehiculo', nombre: 'Vehículo' },
  { id: 'vivienda', nombre: 'Vivienda' },
];

export const TASAS: TasaEntidad[] = [
  // Libre inversión
  {
    entidad: 'AV Villas',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 21.48,
    tasaAnunciada: 14.1,
  },
  {
    entidad: 'Confiar',
    tipo: 'Cooperativa',
    producto: 'libre-inversion',
    tasaReal: 21.9,
    tasaAnunciada: 17.9,
  },
  {
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 22.15,
    tasaAnunciada: 18.5,
  },
  {
    entidad: 'Davivienda',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 22.9,
    tasaAnunciada: 19,
  },
  {
    entidad: 'BBVA',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 24.1,
    tasaAnunciada: 17.2,
  },
  {
    entidad: 'Serfinanza',
    tipo: 'Financiera',
    producto: 'libre-inversion',
    tasaReal: 25.6,
    tasaAnunciada: 19.5,
  },
  {
    entidad: 'Banco de Bogotá',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 26.38,
    tasaAnunciada: null,
  },

  // Libranza
  {
    entidad: 'Banco Popular',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 16.4,
    tasaAnunciada: 13.9,
  },
  {
    entidad: 'Banco de Occidente',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 17.2,
    tasaAnunciada: 14.5,
  },
  {
    entidad: 'Banco de Bogotá',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 17.8,
    tasaAnunciada: 14.2,
  },
  {
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 18.3,
    tasaAnunciada: 15.1,
  },
  {
    entidad: 'Coopcentral',
    tipo: 'Cooperativa',
    producto: 'libranza',
    tasaReal: 19.4,
    tasaAnunciada: 16,
  },
  {
    entidad: 'Giros y Finanzas',
    tipo: 'Financiera',
    producto: 'libranza',
    tasaReal: 21.2,
    tasaAnunciada: null,
  },

  // Compra de cartera
  {
    entidad: 'AV Villas',
    tipo: 'Banco',
    producto: 'compra-cartera',
    tasaReal: 19.8,
    tasaAnunciada: 14.1,
  },
  {
    entidad: 'Davivienda',
    tipo: 'Banco',
    producto: 'compra-cartera',
    tasaReal: 20.6,
    tasaAnunciada: 16.9,
  },
  {
    entidad: 'Confiar',
    tipo: 'Cooperativa',
    producto: 'compra-cartera',
    tasaReal: 21.1,
    tasaAnunciada: 17.5,
  },
  {
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'compra-cartera',
    tasaReal: 21.7,
    tasaAnunciada: 17.8,
  },

  // Vehículo
  {
    entidad: 'Banco de Occidente',
    tipo: 'Banco',
    producto: 'vehiculo',
    tasaReal: 15.9,
    tasaAnunciada: 12.9,
  },
  {
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'vehiculo',
    tasaReal: 16.7,
    tasaAnunciada: 13.5,
  },
  {
    entidad: 'Davivienda',
    tipo: 'Banco',
    producto: 'vehiculo',
    tasaReal: 17.1,
    tasaAnunciada: 13.9,
  },
  {
    entidad: 'Finandina',
    tipo: 'Banco',
    producto: 'vehiculo',
    tasaReal: 18.6,
    tasaAnunciada: 14.9,
  },
  {
    entidad: 'GM Financial',
    tipo: 'Financiera',
    producto: 'vehiculo',
    tasaReal: 19.2,
    tasaAnunciada: 15.5,
  },

  // Vivienda
  {
    entidad: 'Fondo Nacional del Ahorro',
    tipo: 'Financiera',
    producto: 'vivienda',
    tasaReal: 11.9,
    tasaAnunciada: 10.5,
  },
  {
    entidad: 'Davivienda',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 12.6,
    tasaAnunciada: 11.2,
  },
  {
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 12.9,
    tasaAnunciada: 11.5,
  },
  {
    entidad: 'Caja Social',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 13.1,
    tasaAnunciada: 11.8,
  },
  {
    entidad: 'BBVA',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 13.4,
    tasaAnunciada: 11.9,
  },
];

/**
 * Tasa de usura de octubre de 2026 para crédito de consumo ordinario
 * (certificada por la Superfinanciera). Ninguna entidad puede cobrar más.
 * Se actualiza cada mes.
 */
export const USURA_CONSUMO = { tasa: 28.59, mes: 'octubre de 2026' };
