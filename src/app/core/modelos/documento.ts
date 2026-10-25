import { Producto } from './tasa';

export type EstadoDocumento = 'nuevo' | 'actual' | 'anterior';

/** Un PDF de tasas de una fuente (colección `documentos`). */
export interface DocumentoPdf {
  id: number;
  fuente: number;
  archivo: {
    id: string;
    filename_download: string | null;
    filesize: number | null;
  };
  estado: EstadoDocumento;
  vigente_desde: string | null;
  origen: 'manual' | 'robot' | null;
  huella: string | null;
  notas: string | null;
  date_created: string | null;
  user_created: { first_name: string | null; last_name: string | null } | null;
}

export interface EntidadAdmin {
  codigo: string;
  nombre: string;
  logo: string | null;
}

/** Fuente de una entidad, con lo necesario para la pantalla de PDF. */
export interface FuenteAdmin {
  id: number;
  producto: Producto;
  tipo: 'pagina' | 'pdf';
  url: string;
  url_indice: string | null;
  entidad: string;
}
