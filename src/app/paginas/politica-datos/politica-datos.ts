import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VERSION_POLITICA } from '../../core/servicios/prospectos.service';

/**
 * Quién responde por los datos (Decreto 1074 de 2015, art. 2.2.2.25.3.1,
 * antes art. 13 del Decreto 1377 de 2013): nombre o razón social, domicilio,
 * dirección, correo y teléfono. Mientras falte alguno, la página lo dice.
 */
export const RESPONSABLE = {
  nombre: 'Juan Camilo Salazar Rojas',
  /** Ciudad. */
  domicilio: 'Cali, Valle del Cauca',
  direccion: 'Carrera 84A # 6A-47, Cali',
  telefono: '+57 318 022 2868',
  correo: 'gerencia@credimetria.com',
  sitio: 'credimetria.com',
};

/** Fecha desde la que rige esta versión de la política. */
export const VIGENTE_DESDE = '2026-11-12';

/**
 * Política de tratamiento de datos personales de Credimetría según la Ley
 * 1581 de 2012, el Decreto 1074 de 2015 (capítulo 25, antes Decreto 1377 de
 * 2013) y, para el contacto de los asesores, la Ley 2300 de 2023.
 */
@Component({
  selector: 'app-politica-datos',
  imports: [RouterLink],
  templateUrl: './politica-datos.html',
  styleUrl: './politica-datos.css',
})
export class PoliticaDatos {
  protected readonly version = VERSION_POLITICA;
  protected readonly responsable = RESPONSABLE;
  protected readonly vigenteDesde = VIGENTE_DESDE;
  /** Faltan datos del responsable: la política no está completa. */
  protected readonly pendiente =
    !RESPONSABLE.nombre ||
    !RESPONSABLE.domicilio ||
    !RESPONSABLE.direccion ||
    !RESPONSABLE.telefono;
}
