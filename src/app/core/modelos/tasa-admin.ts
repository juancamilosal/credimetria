import { Producto } from './tasa';

export type EstadoTasa = 'por_revisar' | 'publicada' | 'rechazada';
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
  entidad: { codigo: string; nombre: string };
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
  tipo_tasa: TipoTasa | null;
  sistema_amortizacion: SistemaTasa | null;
  frase: string | null;
  vigente_desde: string | null;
  capturada: string | null;
  estado: EstadoTasa;
  revisada_en: string | null;
  notas: string | null;
  entidad: { codigo: string; nombre: string };
  fuente: Omit<FuenteTasa, 'entidad' | 'producto'> | null;
  revisada_por: { first_name: string | null; last_name: string | null } | null;
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
    | 'tipo_tasa'
    | 'sistema_amortizacion'
    | 'frase'
    | 'vigente_desde'
    | 'notas'
  >
>;

export const ESTADOS_TASA: { id: EstadoTasa; texto: string }[] = [
  { id: 'por_revisar', texto: 'Por revisar' },
  { id: 'publicada', texto: 'Publicadas' },
  { id: 'rechazada', texto: 'Rechazadas' },
];

export const UNIDADES_TASA: { id: UnidadTasa; texto: string }[] = [
  { id: 'MV', texto: 'M.V.' },
  { id: 'NMV', texto: 'N.M.V.' },
  { id: 'EA', texto: 'E.A.' },
];
