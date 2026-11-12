import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERSION_POLITICA } from './prospectos.service';

export const TIPOS_ALIADO = [
  { id: 'independiente', texto: 'Asesor independiente' },
  { id: 'fuerza_ventas', texto: 'Fuerza de ventas' },
  { id: 'empleado_entidad', texto: 'Empleado de la entidad' },
  { id: 'empresa', texto: 'Empresa asesora' },
] as const;

export const VINCULOS = [
  { id: 'carta', texto: 'Carta de la entidad' },
  { id: 'certificado', texto: 'Certificado' },
  { id: 'contrato', texto: 'Contrato' },
  { id: 'otro', texto: 'Otro' },
] as const;

export const PRODUCTOS_ALIADO = [
  'Libranza',
  'Libre inversión',
  'Vehículo',
  'Hipotecario',
  'Leasing habitacional',
  'Tarjeta de crédito',
  'Compra de cartera',
  'Préstamos con reportes',
];

/** Texto exacto de la autorización; se guarda con la solicitud. */
export const TEXTO_AUTORIZACION_ALIADO =
  'Autorizo a Credimetría a tratar mis datos para estudiar mi solicitud como asesor aliado, verificar mi vínculo con las entidades y contactarme. Si me aprueban, autorizo publicar mi nombre, empresa, entidades, productos y ciudades en credimetria.com/aliados. Acepto la política de tratamiento de datos.';

export interface DatosSolicitudAliado {
  nombre: string;
  cedula: string;
  celular: string;
  correo: string;
  ciudad: string;
  tipo: string;
  empresa: string | null;
  entidades: string[];
  productos: string[];
  ciudades: string[];
  experiencia: number;
  vinculo: string;
  mensaje: string | null;
  aceptaReglas: boolean;
}

/** Manda "Quiero ser aliado" a /api/solicitudes-aliados. */
@Injectable({ providedIn: 'root' })
export class SolicitudesAliadosService {
  private readonly http = inject(HttpClient);

  async enviar(
    datos: DatosSolicitudAliado,
    paginaOrigen: string,
    turnstileToken: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/solicitudes-aliados', {
        ...datos,
        autorizacion: {
          fecha: new Date().toISOString(),
          texto: TEXTO_AUTORIZACION_ALIADO,
          versionPolitica: VERSION_POLITICA,
          paginaOrigen,
        },
        turnstileToken,
      }),
    );
  }
}
