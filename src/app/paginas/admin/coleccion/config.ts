/** Tipo de campo en el formulario de la administración. */
export type TipoCampo =
  | 'texto'
  | 'correo'
  | 'telefono'
  | 'area'
  | 'numero'
  | 'fecha'
  | 'booleano'
  | 'opciones'
  | 'lista'
  | 'imagen'
  | 'relacion'
  | 'json';

export interface Opcion {
  valor: string;
  texto: string;
}

export interface CampoAdmin {
  campo: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: Opcion[];
  /** Para `relacion`: la colección y el campo que se muestra. */
  relacion?: { coleccion: string; etiqueta: string };
  /** Para `imagen`: carpeta de Directus donde se sube. */
  carpeta?: string;
  obligatorio?: boolean;
  /** Solo se ve; no se edita (fechas de Directus, autorización…). */
  soloLectura?: boolean;
  /** Se escribe al crear y luego no cambia (por ejemplo, el id). */
  soloAlCrear?: boolean;
  ayuda?: string;
  /** Ocupa todo el ancho del formulario. */
  ancho?: boolean;
}

export interface ColumnaAdmin {
  campo: string;
  etiqueta: string;
  /** Cómo se muestra: texto, fecha, etiqueta de estado o foto. */
  como?: 'texto' | 'fecha' | 'estado' | 'foto' | 'si-no';
}

/** Lo que define cada sección de la administración. */
export interface ConfigColeccion {
  coleccion: string;
  titulo: string;
  texto: string;
  /** Singular para los botones: "asesor", "prospecto"… */
  nombre: string;
  /** Campo con la llave primaria. */
  llave: string;
  /** Llave de texto que se escribe al crear (asesores). */
  llaveManual?: boolean;
  orden: string;
  columnas: ColumnaAdmin[];
  campos: CampoAdmin[];
  /** Campos donde busca el buscador. */
  buscar: string[];
  /** Campo y opciones del filtro por estado. */
  estado?: { campo: string; opciones: Opcion[] };
  /** Título de cada registro en el formulario. */
  tituloRegistro: (r: Record<string, unknown>) => string;
  /** Se puede crear desde aquí (los reportes y solicitudes llegan de la página). */
  crear: boolean;
}

export const opciones = (pares: [string, string][]): Opcion[] =>
  pares.map(([valor, texto]) => ({ valor, texto }));
