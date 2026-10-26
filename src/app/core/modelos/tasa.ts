/** Tipos de crédito que compara Credimetría. */
export type Producto =
  | 'libre-inversion'
  | 'libranza'
  | 'compra-cartera'
  | 'vehiculo'
  | 'vivienda';

export type TipoEntidad = 'Banco' | 'Cooperativa' | 'Financiera';

/** Tasa de una entidad para un producto, en efectivo anual (E.A.). */
export interface TasaEntidad {
  entidad: string;
  tipo: TipoEntidad;
  producto: Producto;
  /** Tasa promedio que la entidad cobra, según su reporte a la Superfinanciera. */
  tasaReal: number;
  /** Tasa "desde" que anuncia la entidad en su PDF; `null` si no la publica. */
  tasaAnunciada: number | null;
  /** Tasa "hasta" del PDF (o el tope de usura si la entidad no la publica). */
  tasaHasta?: number | null;
  /** El "hasta" es el tope de usura, no un dato de la entidad. */
  hastaUsura?: boolean;
  /** Desde cuándo rige el PDF (AAAA-MM-DD). */
  vigencia?: string | null;
  /** Dirección del PDF oficial de la entidad (o de su página de tasas). */
  pdf?: string | null;
  /** La entidad no publica PDF: `pdf` es su página de tasas. */
  enPagina?: boolean;
  /** Logo de la entidad (dirección de la imagen). */
  logo?: string | null;
}

export interface InfoProducto {
  id: Producto;
  nombre: string;
}

/** De dónde salen las tasas y hasta qué fecha van. */
export interface CorteTasas {
  fuente: string;
  /** Fecha de corte en formato ISO (AAAA-MM-DD); `null` si no hay datos. */
  fecha: string | null;
  /** `true` mientras los datos sean de ejemplo y no vengan de la base de datos. */
  ejemplo: boolean;
}
