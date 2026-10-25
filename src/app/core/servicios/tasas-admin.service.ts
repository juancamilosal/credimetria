import { inject, Injectable } from '@angular/core';
import {
  CambiosTasa,
  EstadoTasa,
  FuenteTasa,
  TasaAdmin,
} from '../modelos/tasa-admin';
import { SesionAdmin } from './sesion-admin.service';

const CAMPOS_TASA = [
  'id',
  'producto',
  'valor_desde',
  'valor_hasta',
  'unidad',
  'ea_desde',
  'ea_hasta',
  'tipo_tasa',
  'sistema_amortizacion',
  'frase',
  'vigente_desde',
  'capturada',
  'estado',
  'revisada_en',
  'notas',
  'entidad.codigo',
  'entidad.nombre',
  'fuente.id',
  'fuente.tipo',
  'fuente.url',
  'fuente.url_indice',
  'revisada_por.first_name',
  'revisada_por.last_name',
].join(',');

const DECIMALES = [
  'valor_desde',
  'valor_hasta',
  'ea_desde',
  'ea_hasta',
] as const;

/** Directus entrega los decimales como texto ("1.3000"). */
function leerTasa(tasa: TasaAdmin): TasaAdmin {
  const copia = { ...tasa };
  for (const campo of DECIMALES) {
    const valor = copia[campo];
    copia[campo] = valor === null || valor === undefined ? null : Number(valor);
  }
  return copia;
}

/** Lee y cambia las tasas publicadas y sus fuentes en Directus. */
@Injectable({ providedIn: 'root' })
export class TasasAdminService {
  private readonly sesion = inject(SesionAdmin);

  async listar(): Promise<TasaAdmin[]> {
    const tasas = await this.sesion.pedir<TasaAdmin[]>(
      'GET',
      `/items/tasas_publicadas?fields=${CAMPOS_TASA}&sort=-capturada&limit=-1`,
    );
    return tasas.map(leerTasa);
  }

  fuentes(): Promise<FuenteTasa[]> {
    return this.sesion.pedir<FuenteTasa[]>(
      'GET',
      '/items/fuentes?fields=id,producto,tipo,url,url_indice,' +
        'entidad.codigo,entidad.nombre&sort=entidad,producto&limit=-1',
    );
  }

  /** Publica o rechaza, y deja dicho quién y cuándo. */
  async cambiarEstado(id: number, estado: EstadoTasa): Promise<TasaAdmin> {
    return this.escribir('PATCH', `/items/tasas_publicadas/${id}`, {
      estado,
      revisada_por: this.sesion.usuario()?.id ?? null,
      revisada_en: new Date().toISOString(),
    });
  }

  guardar(id: number, cambios: CambiosTasa): Promise<TasaAdmin> {
    return this.escribir('PATCH', `/items/tasas_publicadas/${id}`, cambios);
  }

  /** Tasa escrita a mano; queda por revisar como las del robot. */
  crear(fuente: FuenteTasa, datos: CambiosTasa): Promise<TasaAdmin> {
    return this.escribir('POST', '/items/tasas_publicadas', {
      ...datos,
      fuente: fuente.id,
      entidad: fuente.entidad.codigo,
      producto: fuente.producto,
      estado: 'por_revisar',
    });
  }

  private async escribir(
    metodo: 'POST' | 'PATCH',
    ruta: string,
    cuerpo: object,
  ): Promise<TasaAdmin> {
    const tasa = await this.sesion.pedir<TasaAdmin>(
      metodo,
      `${ruta}?fields=${CAMPOS_TASA}`,
      cuerpo,
    );
    return leerTasa(tasa);
  }
}
