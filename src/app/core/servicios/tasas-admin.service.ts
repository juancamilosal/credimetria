import { inject, Injectable } from '@angular/core';
import { DocumentoPdf, FuenteAdmin } from '../modelos/documento';
import {
  CambiosTasa,
  EstadoTasa,
  PromedioAdmin,
  TasaAdmin,
} from '../modelos/tasa-admin';
import { esVivienda } from '../datos/tasas';
import { tasaMensual } from '../utilidades/credito';
import { SesionAdmin } from './sesion-admin.service';

/** La usura guardada en Directus (colección `usura`, un solo registro). */
export interface UsuraAdmin {
  /** E.A. en porcentaje (28.34). */
  tasa: number;
  /** Primer día del mes: "2026-11-01". */
  mes: string;
}

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
  'documento.archivo_resaltado.id',
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

  /** El promedio de la Superfinanciera de cada entidad y producto. */
  async promedios(): Promise<PromedioAdmin[]> {
    const filas = await this.sesion.pedir<PromedioAdmin[]>(
      'GET',
      '/items/tasas_promedio?limit=-1&fields=entidad,producto,tasa_ea,corte,estado,creditos,consulta_url',
    );
    return filas.map((p) => ({
      ...p,
      tasa_ea: p.tasa_ea === null ? null : Number(p.tasa_ea),
      creditos: p.creditos === null ? null : Number(p.creditos),
    }));
  }

  /** La usura del mes; `null` si todavía no hay. */
  async usura(): Promise<UsuraAdmin | null> {
    const fila = await this.sesion.pedir<{
      tasa_ea: string | number | null;
      mes: string | null;
    } | null>('GET', '/items/usura?fields=tasa_ea,mes');
    if (!fila || fila.tasa_ea === null || !fila.mes) return null;
    return { tasa: Number(fila.tasa_ea), mes: fila.mes.slice(0, 10) };
  }

  /**
   * Guarda la usura nueva y la pone de "hasta" en las tasas que usan el tope
   * de usura (publicadas y por aprobar; en vivienda no aplica). Devuelve las
   * tasas cambiadas.
   */
  async guardarUsura(
    usura: UsuraAdmin,
    tasas: TasaAdmin[],
  ): Promise<TasaAdmin[]> {
    await this.sesion.pedir('PATCH', '/items/usura', {
      tasa_ea: usura.tasa,
      mes: usura.mes,
    });
    const mensual = +(tasaMensual(usura.tasa) * 100).toFixed(2);
    const cambios = tasas
      .filter(
        (t) =>
          t.hasta_origen === 'usura' &&
          (t.estado === 'publicada' || t.estado === 'por_revisar') &&
          !esVivienda(t.producto),
      )
      .map((t) => ({
        id: t.id,
        ea_hasta: usura.tasa,
        valor_hasta: t.unidad === 'EA' ? usura.tasa : mensual,
      }));
    if (!cambios.length) return [];
    const cambiadas = await this.sesion.pedir<TasaAdmin[]>(
      'PATCH',
      `/items/tasas_publicadas?fields=${CAMPOS_TASA}`,
      cambios,
    );
    return cambiadas.map(leerTasa);
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
   * Tasa por aprobar unida a un PDF (o pantallazo) recién cargado. Si hay
   * una tasa publicada (`base`), copia sus valores para no escribirlos de
   * nuevo; si no, se llenan después. El enlace del sitio lleva a la fuente.
   */
  crearDesdeDocumento(
    fuente: FuenteAdmin,
    documento: DocumentoPdf,
    base: TasaAdmin | null = null,
  ): Promise<TasaAdmin> {
    return this.escribir('POST', '/items/tasas_publicadas', {
      fuente: fuente.id,
      entidad: fuente.entidad,
      producto: fuente.producto,
      documento: documento.id,
      enlace: fuente.url,
      enlace_es_pagina: fuente.tipo === 'pagina',
      vigente_desde: documento.vigente_desde ?? base?.vigente_desde ?? null,
      unidad: base?.unidad ?? 'MV',
      estado: 'por_revisar',
      ...(base && {
        valor_desde: base.valor_desde,
        valor_hasta: base.valor_hasta,
        ea_desde: base.ea_desde,
        ea_hasta: base.ea_hasta,
        hasta_origen: base.hasta_origen,
        tipo_tasa: base.tipo_tasa,
        sistema_amortizacion: base.sistema_amortizacion,
        frase: base.frase,
        notas:
          'Valores copiados de la tasa publicada al cargar el archivo: revisa que sigan iguales.',
      }),
    });
  }

  /**
   * Une un PDF (o pantallazo) recién cargado a la tasa que ya espera
   * aprobación, sin tocar sus valores. La vigencia cambia solo si se escribió
   * al cargar.
   */
  unirDocumento(tasa: TasaAdmin, documento: DocumentoPdf): Promise<TasaAdmin> {
    return this.escribir('PATCH', `/items/tasas_publicadas/${tasa.id}`, {
      documento: documento.id,
      ...(documento.vigente_desde && {
        vigente_desde: documento.vigente_desde,
      }),
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
