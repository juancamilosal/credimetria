/** Tipos de crédito que compara Credimetría. */
export type Producto = 'libre-inversion' | 'libranza' | 'vehiculo' | 'vivienda';

export type TipoEntidad = 'Banco' | 'Cooperativa' | 'Financiera';

/** Tasa de una entidad para un producto, en efectivo anual (E.A.). */
export interface TasaEntidad {
  entidad: string;
  tipo: TipoEntidad;
  producto: Producto;
  /** Tasa promedio que la entidad cobra, según su reporte a la Superfinanciera. */
  tasaReal: number;
  /** Tasa "desde" que anuncia la entidad; `null` si no la publica. */
  tasaAnunciada: number | null;
}

export interface InfoProducto {
  id: Producto;
  nombre: string;
  /** Monto y plazo con los que se muestra la cuota de ejemplo. */
  montoEjemplo: number;
  plazoEjemplo: number;
}

/** De dónde salen las tasas y hasta qué fecha van. */
export interface CorteTasas {
  fuente: string;
  /** Fecha de corte en formato ISO (AAAA-MM-DD). */
  fecha: string;
  /** `true` mientras las tasas sean de ejemplo y no vengan de la actualización automática. */
  ejemplo: boolean;
}
