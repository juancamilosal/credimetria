import { Producto } from './tasa';

export type Urgencia = 'ya' | 'mes' | 'tres';

export const URGENCIAS: { id: Urgencia; texto: string; cuando: string }[] = [
  { id: 'ya', texto: 'Ya', cuando: 'hoy mismo' },
  { id: 'mes', texto: 'Este mes', cuando: 'en los próximos días' },
  { id: 'tres', texto: 'En 3 meses', cuando: 'pronto' },
];

export interface Canales {
  whatsapp: boolean;
  llamada: boolean;
  correo: boolean;
}

/**
 * Lo que la persona llena en el formulario de asesoría: lo mínimo para que
 * un asesor la contacte. Ingresos, reportes y demás los pregunta el asesor.
 */
export interface DatosProspecto {
  producto: Producto;
  /** Monto aproximado; `null` si no lo dijo. */
  monto: number | null;
  ciudad: string;
  /** Solo si llegó desde una pantalla que la preguntó (inicio, Compara tu oferta). */
  urgencia: Urgencia | null;
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
