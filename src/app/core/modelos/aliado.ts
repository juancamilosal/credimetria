/** Asesor de crédito que puede recibir los datos de un prospecto. */
export interface Aliado {
  id: string;
  nombre: string;
  empresa: string;
  verificado: boolean;
  entidades: string[];
  productos: string[];
  ciudades: string[];
  /** Foto (de Directus, por /api/asesores/<id>/foto), con su autorización; si no, iniciales. */
  foto?: string;
}
