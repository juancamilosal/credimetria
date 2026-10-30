import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatosProspecto, Prospecto } from '../modelos/prospecto';

/** Versión de la política de tratamiento de datos que acepta la persona. */
export const VERSION_POLITICA = '2026-10-borrador';

/** Texto exacto de la autorización; se guarda tal cual con cada prospecto. */
export const TEXTO_AUTORIZACION =
  'Autorizo a Credimetría a compartir mis datos con los asesores de crédito aliados publicados en credimetria.co/aliados, para que me contacten y me ofrezcan créditos. Me contactarán máximo 2 asesores. Acepto la política de tratamiento de datos.';

/**
 * Arma el prospecto con la prueba de la autorización y lo manda a
 * /api/prospectos: el servidor le agrega la IP, lo guarda en Directus y
 * manda el correo a la persona y al administrador.
 */
@Injectable({ providedIn: 'root' })
export class ProspectosService {
  private readonly http = inject(HttpClient);

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

  /** Lanza error si el servidor no lo pudo guardar. */
  async enviar(prospecto: Prospecto): Promise<void> {
    await firstValueFrom(this.http.post('/api/prospectos', prospecto));
  }
}
