import { CorteTasas, InfoProducto, TasaEntidad } from '../modelos/tasa';

/*
 * Tasas de ejemplo para armar la página mientras se construye la Fase 1
 * (recolector de datos.gov.co con historial en la base de datos).
 * Cuando llegue la actualización automática, este archivo se reemplaza por
 * la consulta a la base de datos y `ejemplo` pasa a `false`.
 */

export const CORTE_TASAS: CorteTasas = {
  fuente: 'Superintendencia Financiera de Colombia',
  fecha: '2026-10-09',
  ejemplo: true,
};

export const PRODUCTOS: InfoProducto[] = [
  {
    id: 'libre-inversion',
    nombre: 'Libre inversión',
    montoEjemplo: 20_000_000,
    plazoEjemplo: 48,
  },
  {
    id: 'libranza',
    nombre: 'Libranza',
    montoEjemplo: 20_000_000,
    plazoEjemplo: 60,
  },
  {
    id: 'vehiculo',
    nombre: 'Vehículo',
    montoEjemplo: 60_000_000,
    plazoEjemplo: 60,
  },
  {
    id: 'vivienda',
    nombre: 'Vivienda',
    montoEjemplo: 200_000_000,
    plazoEjemplo: 180,
  },
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
    entidad: 'Banco de Bogotá',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 23.38,
    tasaAnunciada: 16.8,
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
    tasaAnunciada: 19.0,
  },
  {
    entidad: 'Banco Popular',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 20.95,
    tasaAnunciada: 15.9,
  },
  {
    entidad: 'BBVA',
    tipo: 'Banco',
    producto: 'libre-inversion',
    tasaReal: 24.1,
    tasaAnunciada: 17.2,
  },
  {
    entidad: 'Confiar',
    tipo: 'Cooperativa',
    producto: 'libre-inversion',
    tasaReal: 21.9,
    tasaAnunciada: 17.9,
  },
  {
    entidad: 'Serfinanza',
    tipo: 'Financiera',
    producto: 'libre-inversion',
    tasaReal: 25.6,
    tasaAnunciada: 19.5,
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
    entidad: 'Bancolombia',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 18.3,
    tasaAnunciada: 15.1,
  },
  {
    entidad: 'Davivienda',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 18.9,
    tasaAnunciada: 15.6,
  },
  {
    entidad: 'Banco de Bogotá',
    tipo: 'Banco',
    producto: 'libranza',
    tasaReal: 17.8,
    tasaAnunciada: 14.2,
  },
  {
    entidad: 'Coopcentral',
    tipo: 'Cooperativa',
    producto: 'libranza',
    tasaReal: 19.4,
    tasaAnunciada: 16.0,
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
    entidad: 'BBVA',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 13.4,
    tasaAnunciada: 11.9,
  },
  {
    entidad: 'Caja Social',
    tipo: 'Banco',
    producto: 'vivienda',
    tasaReal: 13.1,
    tasaAnunciada: 11.8,
  },
];
