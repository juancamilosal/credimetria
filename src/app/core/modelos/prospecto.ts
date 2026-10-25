import { Producto } from './tasa';

export type Urgencia = 'ya' | 'mes' | 'tres';

export const URGENCIAS: { id: Urgencia; texto: string; cuando: string }[] = [
  { id: 'ya', texto: 'Ya', cuando: 'hoy mismo' },
  { id: 'mes', texto: 'Este mes', cuando: 'en los próximos días' },
  { id: 'tres', texto: 'En 3 meses', cuando: 'pronto' },
];

export const INGRESOS = [
  'Pensionado',
  'Empleado',
  'Docente',
  'Empleado público',
  'Independiente',
] as const;

export const SALARIOS = [
  'Menos de $2 millones',
  '$2 a $4 millones',
  '$4 a $8 millones',
  'Más de $8 millones',
] as const;

export type Reporte = 'no' | 'si' | 'no-se';

export interface Canales {
  whatsapp: boolean;
  llamada: boolean;
  correo: boolean;
}

/** Lo que la persona llena en el formulario de asesoría. */
export interface DatosProspecto {
  producto: Producto;
  monto: number;
  ingreso: string;
  salario: string;
  ciudad: string;
  reporte: Reporte;
  urgencia: Urgencia;
  nombre: string;
  celular: string;
  canales: Canales;
  correo: string | null;
  /** Entidad elegida en el ranking, si llegó desde allí. */
  entidad: string | null;
}

/** Prueba de la autorización de datos (Ley 1581). Sin ella el prospecto no se puede vender. */
export interface Autorizacion {
  fecha: string;
  texto: string;
  versionPolitica: string;
  paginaOrigen: string;
  /** La pone el servidor al recibir el prospecto. */
  ip?: string;
}

export interface Prospecto extends DatosProspecto {
  autorizacion: Autorizacion;
}
