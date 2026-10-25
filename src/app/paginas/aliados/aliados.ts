import { Component, inject } from '@angular/core';
import { AliadosService } from '../../core/servicios/aliados.service';

/** Lista pública de quienes pueden recibir los datos de un prospecto. */
@Component({
  selector: 'app-aliados',
  templateUrl: './aliados.html',
  styleUrl: './aliados.css',
})
export class Aliados {
  private readonly servicio = inject(AliadosService);

  protected readonly aliados = this.servicio.lista();
  protected readonly ejemplo = this.servicio.ejemplo;

  protected readonly reglas = [
    {
      titulo: 'Nunca cobrar por adelantado.',
      texto: 'Ni por estudio, ni por "aprobar" el crédito.',
    },
    {
      titulo: 'Usar tus datos solo para ofrecerte crédito.',
      texto: 'No los revende ni los comparte.',
    },
    {
      titulo: 'Respetar horarios y canales.',
      texto: 'Solo por el canal que elegiste, en los horarios de la ley.',
    },
    {
      titulo: 'Demostrar su vínculo con la entidad.',
      texto: 'Con carta o certificado.',
    },
    {
      titulo: 'Borrar tus datos si lo pides.',
      texto: 'Te avisamos cuando esté hecho.',
    },
  ];

  /** "Asesor de ejemplo" → "AE". */
  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}
