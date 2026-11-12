import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERSION_POLITICA } from './prospectos.service';

/** Motivos del reporte (los mismos de servidor/asesores.mjs). */
export const MOTIVOS_REPORTE = [
  { id: 'cobro_adelantado', texto: 'Me pidió dinero por adelantado' },
  { id: 'datos', texto: 'Usó o compartió mis datos sin permiso' },
  {
    id: 'horario_canal',
    texto: 'Me contactó fuera de horario o por otro canal',
  },
  {
    id: 'suplantacion',
    texto: 'Se hizo pasar por el banco o por Credimetría',
  },
  { id: 'trato', texto: 'Mal trato o información falsa' },
  { id: 'otro', texto: 'Otro' },
] as const;

export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number]['id'];

/** Texto exacto de la autorización del reporte; se guarda con él. */
export const TEXTO_AUTORIZACION_REPORTE =
  'Autorizo a Credimetría a tratar los datos de este reporte para revisarlo, pedirle explicaciones al asesor y contactarme sobre él. Acepto la política de tratamiento de datos.';

export interface DatosReporte {
  /** Id del asesor publicado, o null si no está en la lista. */
  asesor: string | null;
  asesorNombre: string | null;
  motivo: MotivoReporte;
  descripcion: string;
  fechaContacto: string | null;
  nombre: string;
  correo: string;
  celular: string | null;
}

/**
 * Manda el reporte a /api/reportes-asesores con la prueba de la
 * autorización; el servidor lo guarda en Directus (`reportes_asesores`) y
 * avisa por correo.
 */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);

  /** Lanza error si el servidor no lo pudo guardar. */
  async enviar(
    datos: DatosReporte,
    paginaOrigen: string,
    turnstileToken: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/reportes-asesores', {
        ...datos,
        autorizacion: {
          fecha: new Date().toISOString(),
          texto: TEXTO_AUTORIZACION_REPORTE,
          versionPolitica: VERSION_POLITICA,
          paginaOrigen,
        },
        turnstileToken,
      }),
    );
  }
}
