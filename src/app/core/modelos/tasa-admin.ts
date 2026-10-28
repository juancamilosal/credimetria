import { Producto } from './tasa';

export type EstadoTasa = 'por_revisar' | 'publicada' | 'rechazada' | 'anterior';
export type UnidadTasa = 'MV' | 'NMV' | 'EA';
export type TipoTasa = 'fija' | 'variable';
export type SistemaTasa = 'cuota_fija' | 'cuota_decreciente' | 'no_dice';

/** Dónde publica una entidad la tasa de un producto (colección `fuentes`). */
export interface FuenteTasa {
  id: number;
  producto: Producto;
  tipo: 'pagina' | 'pdf';
  url: string;
  url_indice: string | null;
  entidad: { codigo: string; nombre: string; logo?: string | null };
}

/** Una tasa publicada por una entidad (colección `tasas_publicadas`). */
export interface TasaAdmin {
  id: number;
  producto: Producto;
  valor_desde: number | null;
  valor_hasta: number | null;
  unidad: UnidadTasa | null;
  ea_desde: number | null;
  ea_hasta: number | null;
  /** De dónde sale el "hasta": lo publica la entidad o es el tope de usura. */
  hasta_origen: 'entidad' | 'usura' | null;
  tipo_tasa: TipoTasa | null;
  sistema_amortizacion: SistemaTasa | null;
  frase: string | null;
  vigente_desde: string | null;
  capturada: string | null;
  estado: EstadoTasa;
  revisada_en: string | null;
  notas: string | null;
  /** `logo` es el id del archivo en Directus. */
  entidad: { codigo: string; nombre: string; logo: string | null };
  fuente: Omit<FuenteTasa, 'entidad' | 'producto'> | null;
  revisada_por: { first_name: string | null; last_name: string | null } | null;
  /** Copia guardada antes de existir `documento` (casos viejos). */
  captura: { id: string; type: string | null } | null;
  /** El PDF de donde salió la tasa. */
  documento: {
    id: number;
    estado: 'nuevo' | 'actual' | 'anterior';
    vigente_desde: string | null;
    archivo: { id: string; filename_download: string | null };
    /** Copia con las cifras de la tasa resaltadas en verde. */
    archivo_resaltado?: { id: string } | null;
  } | null;
}

/** Lo que se puede escribir de una tasa desde la configuración. */
export type CambiosTasa = Partial<
  Pick<
    TasaAdmin,
    | 'valor_desde'
    | 'valor_hasta'
    | 'unidad'
    | 'ea_desde'
    | 'ea_hasta'
    | 'hasta_origen'
    | 'tipo_tasa'
    | 'sistema_amortizacion'
    | 'frase'
    | 'vigente_desde'
    | 'notas'
  >
> & { documento?: number | null };

export const UNIDADES_TASA: { id: UnidadTasa; texto: string }[] = [
  { id: 'MV', texto: 'M.V.' },
  { id: 'NMV', texto: 'N.M.V.' },
  { id: 'EA', texto: 'E.A.' },
];

/**
 * Lo que leyó el servidor de un PDF cargado a mano (/api/admin/leer), con
 * las mismas reglas del robot. `resaltado`: la copia con la tasa en verde,
 * en base64.
 */
export interface LecturaPdf {
  leida: boolean;
  problemas: string[];
  tasa?: {
    unidad: UnidadTasa;
    valor_desde: number | null;
    valor_hasta: number | null;
    ea_desde: number | null;
    ea_hasta: number | null;
    hasta_origen: 'entidad' | 'usura';
    vigente_desde: string | null;
    frase: string | null;
    solo_maxima: boolean;
    usura_mes: string | null;
  };
  resaltado?: string | null;
}
