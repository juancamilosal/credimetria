import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chips } from '../../compartido/chips/chips';
import { TablaRanking } from '../../compartido/tabla-ranking/tabla-ranking';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';
import { Simulador } from './simulador/simulador';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, Chips, TablaRanking, Simulador],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly tasas = inject(TasasService);

  protected readonly corte = this.tasas.corte;
  /** Producto elegido en el simulador; el ranking resumido lo sigue. */
  protected readonly producto = signal<Producto>('libre-inversion');
  protected readonly top = computed(() =>
    this.tasas.ranking(this.producto()).slice(0, 3),
  );
  protected readonly nombreProducto = computed(() =>
    this.tasas.nombre(this.producto()),
  );

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
