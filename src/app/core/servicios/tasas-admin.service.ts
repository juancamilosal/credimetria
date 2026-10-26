import { inject, Injectable } from '@angular/core';
import { DocumentoPdf, FuenteAdmin } from '../modelos/documento';
import { CambiosTasa, EstadoTasa, TasaAdmin } from '../modelos/tasa-admin';
import { SesionAdmin } from './sesion-admin.service';

const CAMPOS_TASA = [
  'id',
  'producto',
  'valor_desde',
  'valor_hasta',
  'unidad',
  'ea_desde',
  'ea_hasta',
  'hasta_origen',
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
  'entidad.logo',
  'fuente.id',
  'fuente.tipo',
  'fuente.url',
  'fuente.url_indice',
  'revisada_por.first_name',
  'revisada_por.last_name',
  'captura.id',
  'captura.type',
  'documento.id',
  'documento.estado',
  'documento.vigente_desde',
  'documento.archivo.id',
  'documento.archivo.filename_download',
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

  /** Publica o rechaza, y deja dicho quién y cuándo. */
  async cambiarEstado(id: number, estado: EstadoTasa): Promise<TasaAdmin> {
    return this.escribir('PATCH', `/items/tasas_publicadas/${id}`, {
      estado,
      revisada_por: this.sesion.usuario()?.id ?? null,
      revisada_en: new Date().toISOString(),
    });
  }

  /**
   * Vuelve a publicar una tasa anterior (cuando se elimina la publicada por
   * un error) y su PDF vuelve a ser el actual.
   */
  async restaurar(tasa: TasaAdmin): Promise<TasaAdmin> {
    if (tasa.documento) {
      await this.sesion.pedir(
        'PATCH',
        `/items/documentos/${tasa.documento.id}`,
        {
          estado: 'actual',
        },
      );
    }
    return this.escribir('PATCH', `/items/tasas_publicadas/${tasa.id}`, {
      estado: 'publicada',
    });
  }

  /** Borra una tasa (por ejemplo, una publicada con un PDF equivocado). */
  async eliminar(id: number): Promise<void> {
    await this.sesion.pedir('DELETE', `/items/tasas_publicadas/${id}`);
  }

  guardar(id: number, cambios: CambiosTasa): Promise<TasaAdmin> {
    return this.escribir('PATCH', `/items/tasas_publicadas/${id}`, cambios);
  }

  /**
   * Aprueba una tasa: queda publicada y su PDF pasa a actual. La tasa que
   * estaba publicada y el PDF que era actual pasan a anteriores; nada se
   * borra.
   */
  async aprobar(
    nueva: TasaAdmin,
    publicada: TasaAdmin | null,
    documentosFuente: DocumentoPdf[],
  ): Promise<TasaAdmin> {
    if (publicada) {
      await this.sesion.pedir(
        'PATCH',
        `/items/tasas_publicadas/${publicada.id}`,
        {
          estado: 'anterior',
        },
      );
    }
    const pdf = nueva.documento?.id;
    if (pdf) {
      for (const d of documentosFuente) {
        if (d.estado === 'actual' && d.id !== pdf) {
          await this.sesion.pedir('PATCH', `/items/documentos/${d.id}`, {
            estado: 'anterior',
          });
        }
      }
      await this.sesion.pedir('PATCH', `/items/documentos/${pdf}`, {
        estado: 'actual',
      });
    }
    return this.cambiarEstado(nueva.id, 'publicada');
  }

  /**
   * Tasa por aprobar unida a un PDF (o pantallazo) recién cargado; los
   * valores se llenan después. El enlace del sitio lleva a la fuente.
   */
  crearDesdeDocumento(
    fuente: FuenteAdmin,
    documento: DocumentoPdf,
  ): Promise<TasaAdmin> {
    return this.escribir('POST', '/items/tasas_publicadas', {
      fuente: fuente.id,
      entidad: fuente.entidad,
      producto: fuente.producto,
      documento: documento.id,
      enlace: fuente.url,
      enlace_es_pagina: fuente.tipo === 'pagina',
      vigente_desde: documento.vigente_desde,
      unidad: 'MV',
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
