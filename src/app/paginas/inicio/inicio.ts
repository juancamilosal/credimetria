import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chips } from '../../compartido/chips/chips';
import { Foto } from '../../compartido/foto/foto';
import {
  PesosPipe,
  PuntosPipe,
  TasaPipe,
} from '../../compartido/pipes/formato';
import {
  MONTO_RANKING,
  PLAZO_RANKING,
} from '../../compartido/tabla-ranking/tabla-ranking';
import { cuotaMensual } from '../../core/utilidades/credito';
import { FUENTE_PROMEDIO } from '../../core/datos/tasas';
import { FOTOS } from '../../core/datos/fotos';
import { URGENCIAS } from '../../core/modelos/prospecto';
import { Producto } from '../../core/modelos/tasa';
import { TasasService } from '../../core/servicios/tasas.service';

/**
 * Inicio: qué hace Credimetría, las 3 tasas más bajas de libre inversión,
 * cómo funciona, con qué entidades comparamos y la entrada a la asesoría.
 */
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, Chips, Foto, PesosPipe, PuntosPipe, TasaPipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly tasas = inject(TasasService);

  protected readonly corte = this.tasas.corte;
  /** Monto y plazo de ejemplo para la cuota de cada tarjeta. */
  protected readonly monto = MONTO_RANKING;
  protected readonly plazo = PLAZO_RANKING;
  protected readonly mejores = computed(() =>
    this.tasas
      .ranking('libre-inversion')
      .slice(0, 3)
      .map((t) => {
        const cuota = cuotaMensual(this.monto, t.tasaReal, this.plazo);
        return {
          ...t,
          diferencia:
            t.tasaAnunciada === null ? null : t.tasaReal - t.tasaAnunciada,
          cuota,
          total: Math.round(cuota) * this.plazo,
        };
      }),
  );
  protected readonly hayUsura = computed(() =>
    this.mejores().some((t) => t.hastaUsura),
  );
  protected readonly entidades = this.tasas.listaEntidades;
  protected readonly fotos = FOTOS;
  protected readonly fuente = FUENTE_PROMEDIO;

  /** Tarjetas con foto por tipo de crédito; cada una lleva a su ranking. */
  protected readonly productos = computed(() =>
    (
      [
        {
          id: 'libre-inversion',
          texto: 'Para lo que necesites, sin explicar en qué lo vas a usar.',
          foto: FOTOS.hombreCuentas,
        },
        {
          id: 'libranza',
          texto:
            'Para empleados, docentes y pensionados: la cuota se descuenta de la nómina.',
          foto: FOTOS.docente,
        },
        {
          id: 'vehiculo',
          texto: 'Para estrenar carro, nuevo o usado.',
          foto: FOTOS.jovenCarro,
        },
        {
          id: 'vivienda',
          texto: 'Para comprar casa o apartamento a largo plazo.',
          foto: FOTOS.familiaVivienda,
        },
      ] as const
    ).map((p) => ({
      ...p,
      id: p.id as Producto,
      titulo: this.tasas.nombre(p.id),
      mejor: this.tasas.mejor(p.id),
    })),
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
