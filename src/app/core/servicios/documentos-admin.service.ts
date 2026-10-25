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
  'estado',
  'vigente_desde',
  'origen',
  'huella',
  'notas',
  'date_created',
  'user_created.first_name',
  'user_created.last_name',
].join(',');

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
      '/items/fuentes?fields=id,producto,tipo,url,url_indice,entidad&limit=-1',
    );
  }

  documentos(): Promise<DocumentoPdf[]> {
    return this.sesion.pedir<DocumentoPdf[]>(
      'GET',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}&sort=-date_created&limit=-1`,
    );
  }

  /** Sube el PDF y lo deja como nuevo. Si ya existe uno igual, avisa. */
  async cargar(
    fuente: number,
    archivo: File,
    vigenteDesde: string | null,
  ): Promise<DocumentoPdf> {
    const huella = await huellaArchivo(archivo);
    const [repetido] = await this.sesion.pedir<DocumentoPdf[]>(
      'GET',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}&filter[huella][_eq]=${huella}&limit=1`,
    );
    if (repetido) throw new DocumentoRepetido(repetido);

    const datos = new FormData();
    datos.append('title', archivo.name);
    datos.append('file', archivo, archivo.name);
    const subido = await this.sesion.pedir<{ id: string }>(
      'POST',
      '/files',
      datos,
    );
    return this.sesion.pedir<DocumentoPdf>(
      'POST',
      `/items/documentos?fields=${CAMPOS_DOCUMENTO}`,
      {
        fuente,
        archivo: subido.id,
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

  /** Quita un PDF nuevo que no sirve (el registro y el archivo). */
  async descartar(documento: DocumentoPdf): Promise<void> {
    await this.sesion.pedir('DELETE', `/items/documentos/${documento.id}`);
    await this.sesion.pedir('DELETE', `/files/${documento.archivo.id}`);
  }

  /** Fuente PDF para un banco que todavía no la tiene. */
  agregarFuente(
    entidad: string,
    producto: Producto,
    url: string,
  ): Promise<FuenteAdmin> {
    return this.sesion.pedir<FuenteAdmin>(
      'POST',
      '/items/fuentes?fields=id,producto,tipo,url,url_indice,entidad',
      {
        entidad,
        producto,
        tipo: 'pdf',
        url,
        como_extraer: 'manual',
        estado: 'activa',
      },
    );
  }
}
