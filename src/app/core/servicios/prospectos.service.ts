import { Injectable } from '@angular/core';
import { DatosProspecto, Prospecto } from '../modelos/prospecto';

/** Versión de la política de tratamiento de datos que acepta la persona. */
export const VERSION_POLITICA = '2026-10-borrador';

/** Texto exacto de la autorización; se guarda tal cual con cada prospecto. */
export const TEXTO_AUTORIZACION =
  'Autorizo a Credimetría a compartir mis datos con los asesores de crédito aliados publicados en credimetria.co/aliados, para que me contacten y me ofrezcan créditos. Me contactarán máximo 2 asesores. Acepto la política de tratamiento de datos.';

/**
 * Arma el prospecto con la prueba de la autorización. Mientras no exista la
 * base de datos no envía nada: el servidor deberá guardarlo y agregar la IP.
 */
@Injectable({ providedIn: 'root' })
export class ProspectosService {
  /** `false` hasta que el formulario guarde de verdad en la base de datos. */
  readonly conectado = false;

  armar(datos: DatosProspecto, paginaOrigen: string): Prospecto {
    return {
      ...datos,
      autorizacion: {
        fecha: new Date().toISOString(),
        texto: TEXTO_AUTORIZACION,
        versionPolitica: VERSION_POLITICA,
        paginaOrigen,
      },
    };
  }

  async enviar(prospecto: Prospecto): Promise<Prospecto> {
    // Pendiente: POST a la API de prospectos cuando exista la base de datos.
    return prospecto;
  }
}
