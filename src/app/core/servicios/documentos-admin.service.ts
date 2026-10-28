import { inject, Injectable } from '@angular/core';
import { DocumentoPdf, EntidadAdmin, FuenteAdmin } from '../modelos/documento';
import { Producto } from '../modelos/tasa';
import { SesionAdmin } from './sesion-admin.service';

const CAMPOS_DOCUMENTO = [
  'id',
  'fuente',
  'archivo.id',
  'archivo.filename_download',
  'archivo.filesize',
  'archivo_resaltado.id',
  'estado',
  'vigente_desde',
  'origen',
  'huella',
  'notas',
  'date_created',
  'user_created.first_name',
  'user_created.last_name',
].join(',');

const CAMPOS_FUENTE = 'id,producto,tipo,url,url_indice,entidad';

/** Dirección directa del PDF y página de tasas y tarifas que lo enlaza. */
export interface Direcciones {
  url: string;
  url_indice: string | null;
}

/** El PDF ya está guardado (misma huella). */
export class DocumentoRepetido extends Error {
  constructor(readonly existente: DocumentoPdf) {
    super('PDF repetido');
  }
}

/** Huella SHA-256 del archivo, en hexadecimal. */
export async function huellaArchivo(archivo: Blob): Promise<string> {
  const datos = await archivo.arrayBuffer();
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(resumen)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Los PDF de tasas de cada fuente: el actual, los nuevos por aceptar (que
 * carga una persona o el robot) y los anteriores, que nunca se borran.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosAdminService {
  private readonly sesion = inject(SesionAdmin);

  entidades(): Promise<EntidadAdmin[]> {
    return this.sesion.pedir<EntidadAdmin[]>(
      'GET',
      '/items/entidades?fields=codigo,nombre,logo&filter[activa][_eq]=true&sort=nombre&limit=-1',
    );
  }

  fuentes(): Promise<FuenteAdmin[]> {
    return this.sesion.pedir<FuenteAdmin[]>(
      'GET',
      `/items/fuentes?fields=${CAMPOS_FUENTE}&limit=-1`,
    );
  }

  documentos(): Promise<DocumentoPdf[]> {
    return this.sesion.pedir<DocumentoPdf[]>(
      'GET',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}&sort=-date_created&limit=-1`,
    );
  }

  /**
   * Sube el PDF y lo deja como nuevo. Si ya existe uno igual para esta
   * fuente (o para otro banco), avisa. Si es el mismo PDF de otro producto
   * del mismo banco (Davivienda trae libre inversión y libranza en uno), no
   * lo sube otra vez: usa ese archivo para el documento de esta fuente.
   */
  async cargar(
    fuente: number,
    archivo: File,
    vigenteDesde: string | null,
  ): Promise<DocumentoPdf> {
    const huella = await huellaArchivo(archivo);
    const repetidos = await this.sesion.pedir<DocumentoPdf[]>(
      'GET',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}&filter[huella][_eq]=${huella}&limit=-1`,
    );
    let archivoId: string | null = null;
    if (repetidos.length) {
      const deEsta = repetidos.find((d) => d.fuente === fuente);
      if (deEsta) throw new DocumentoRepetido(deEsta);
      // ¿De otro producto del mismo banco?
      const ids = [fuente, ...repetidos.map((d) => d.fuente)].join(',');
      const fuentes = await this.sesion.pedir<
        { id: number; entidad: string }[]
      >(
        'GET',
        `/items/fuentes?fields=id,entidad&filter[id][_in]=${ids}&limit=-1`,
      );
      const banco = fuentes.find((f) => f.id === fuente)?.entidad;
      const mismoBanco = repetidos.find(
        (d) => fuentes.find((f) => f.id === d.fuente)?.entidad === banco,
      );
      if (!banco || !mismoBanco) throw new DocumentoRepetido(repetidos[0]);
      archivoId = mismoBanco.archivo.id;
    }

    if (!archivoId) {
      const datos = new FormData();
      datos.append('title', archivo.name);
      datos.append('file', archivo, archivo.name);
      archivoId = (
        await this.sesion.pedir<{ id: string }>('POST', '/files', datos)
      ).id;
    }
    return this.sesion.pedir<DocumentoPdf>(
      'POST',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}`,
      {
        fuente,
        archivo: archivoId,
        estado: 'nuevo',
        vigente_desde: vigenteDesde,
        origen: 'manual',
        huella,
      },
    );
  }

  /** El nuevo pasa a actual y el actual de esa fuente, a anterior. */
  async usarComoActual(
    nuevo: DocumentoPdf,
    actual: DocumentoPdf | null,
  ): Promise<void> {
    if (actual) {
      await this.sesion.pedir('PATCH', `/items/documentos/${actual.id}`, {
        estado: 'anterior',
      });
    }
    await this.sesion.pedir('PATCH', `/items/documentos/${nuevo.id}`, {
      estado: 'actual',
    });
  }

  /** Sube la copia con la tasa resaltada (base64) y la une al documento. */
  async guardarResaltado(
    documento: DocumentoPdf,
    base64: string,
  ): Promise<DocumentoPdf> {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const nombre = (documento.archivo.filename_download ?? 'tasas.pdf').replace(
      /\.pdf$/i,
      '',
    );
    const datos = new FormData();
    datos.append('title', `${nombre} · resaltado`);
    datos.append(
      'file',
      new Blob([bytes], { type: 'application/pdf' }),
      `${nombre}-resaltado.pdf`,
    );
    const subido = await this.sesion.pedir<{ id: string }>(
      'POST',
      '/files',
      datos,
    );
    const cambiado = await this.sesion.pedir<DocumentoPdf>(
      'PATCH',
      `/items/documentos/${documento.id}?fields=${CAMPOS_DOCUMENTO}`,
      { archivo_resaltado: subido.id },
    );
    // Al volver a leer un PDF ya cargado, la copia anterior sobra.
    await this.borrarResaltado(documento);
    return cambiado;
  }

  /** Corrige la vigencia de un PDF cargado. */
  cambiarVigencia(
    id: number,
    vigenteDesde: string | null,
  ): Promise<DocumentoPdf> {
    return this.sesion.pedir<DocumentoPdf>(
      'PATCH',
      `/items/documentos/${id}?fields=${CAMPOS_DOCUMENTO}`,
      { vigente_desde: vigenteDesde },
    );
  }

  /**
   * Cambia el archivo de un PDF cargado por error por el correcto. Si el
   * nuevo ya está guardado en otro registro, avisa y no cambia nada.
   */
  async reemplazarArchivo(
    documento: DocumentoPdf,
    archivo: File,
  ): Promise<DocumentoPdf> {
    const huella = await huellaArchivo(archivo);
    const [repetido] = await this.sesion.pedir<DocumentoPdf[]>(
      'GET',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}&filter[huella][_eq]=${huella}&limit=1`,
    );
    if (repetido && repetido.id !== documento.id) {
      throw new DocumentoRepetido(repetido);
    }
    const datos = new FormData();
    datos.append('title', archivo.name);
    datos.append('file', archivo, archivo.name);
    const subido = await this.sesion.pedir<{ id: string }>(
      'POST',
      '/files',
      datos,
    );
    const cambiado = await this.sesion.pedir<DocumentoPdf>(
      'PATCH',
      `/items/documentos/${documento.id}?fields=${CAMPOS_DOCUMENTO}`,
      // La copia resaltada era del archivo anterior.
      { archivo: subido.id, huella, archivo_resaltado: null },
    );
    await this.borrarSiNadieLoUsa(documento.archivo.id);
    await this.borrarResaltado(documento);
    return cambiado;
  }

  /** Quita un PDF nuevo que no sirve (el registro y el archivo). */
  async descartar(documento: DocumentoPdf): Promise<void> {
    await this.sesion.pedir('DELETE', `/items/documentos/${documento.id}`);
    await this.borrarSiNadieLoUsa(documento.archivo.id);
    await this.borrarResaltado(documento);
  }

  /** La copia resaltada es solo de este documento: se borra con él. */
  private async borrarResaltado(documento: DocumentoPdf): Promise<void> {
    const id = documento.archivo_resaltado?.id;
    if (id) await this.sesion.pedir('DELETE', `/files/${id}`);
  }

  /**
   * Borra el archivo solo si ningún otro documento lo usa: el mismo PDF puede
   * ser de dos productos del banco (libre inversión y libranza).
   */
  private async borrarSiNadieLoUsa(archivo: string): Promise<void> {
    const otros = await this.sesion.pedir<{ id: number }[]>(
      'GET',
      `/items/documentos?fields=id&filter[archivo][_eq]=${archivo}&limit=1`,
    );
    if (!otros.length) await this.sesion.pedir('DELETE', `/files/${archivo}`);
  }

  /**
   * Fuente PDF para un banco que todavía no la tiene: la dirección directa
   * del PDF y, si existe, la página de tasas y tarifas que lo enlaza.
   */
  agregarFuente(
    entidad: string,
    producto: Producto,
    direcciones: Direcciones,
  ): Promise<FuenteAdmin> {
    return this.sesion.pedir<FuenteAdmin>(
      'POST',
      `/items/fuentes?fields=${CAMPOS_FUENTE}`,
      {
        entidad,
        producto,
        tipo: 'pdf',
        ...direcciones,
        como_extraer: 'manual',
        estado: 'activa',
      },
    );
  }

  editarFuente(id: number, direcciones: Direcciones): Promise<FuenteAdmin> {
    return this.sesion.pedir<FuenteAdmin>(
      'PATCH',
      `/items/fuentes/${id}?fields=${CAMPOS_FUENTE}`,
      direcciones,
    );
  }
}
