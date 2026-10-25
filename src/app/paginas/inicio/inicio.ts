import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chips } from '../../compartido/chips/chips';
import { PuntosPipe, TasaPipe } from '../../compartido/pipes/formato';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { TasasService } from '../../core/servicios/tasas.service';

/**
 * Inicio: qué hace Credimetría, las 3 tasas más bajas de libre inversión,
 * cómo funciona, con qué entidades comparamos y la entrada a la asesoría.
 */
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, Chips, PuntosPipe, TasaPipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly tasas = inject(TasasService);

  protected readonly corte = this.tasas.corte;
  protected readonly mejores = this.tasas
    .ranking('libre-inversion')
    .slice(0, 3)
    .map((t) => ({
      ...t,
      diferencia:
        t.tasaAnunciada === null ? null : t.tasaReal - t.tasaAnunciada,
    }));
  protected readonly entidades = this.tasas.entidades();

  protected readonly urgencias = URGENCIAS.map((u) => ({
    valor: u.id,
    texto: u.texto,
  }));
  protected readonly urgencia = signal<string>('ya');

  protected readonly pasos = [
    {
      titulo: 'Compara',
      texto:
        'Mira la tasa que anuncia cada entidad al lado de la que cobra en promedio.',
    },
    {
      titulo: 'Cuéntanos qué necesitas',
      texto: 'Producto, monto y cuándo lo necesitas. Toma menos de un minuto.',
    },
    {
      titulo: 'Un asesor aliado te contacta',
      texto:
        'Máximo 2 asesores verificados. Nunca te cobran nada por adelantado.',
    },
  ];
}
