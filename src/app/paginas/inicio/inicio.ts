import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TasasService } from '../../core/servicios/tasas.service';
import { MejoresTasas } from './mejores-tasas/mejores-tasas';
import { Simulador } from './simulador/simulador';

@Component({
  selector: 'app-inicio',
  imports: [DecimalPipe, RouterLink, MejoresTasas, Simulador],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly tasas = inject(TasasService);

  /** Ejemplo de la portada: la mayor brecha entre tasa anunciada y tasa cobrada. */
  protected readonly brecha = this.tasas.mayorBrecha('libre-inversion');
  /** Escala de las barras de la portada, en puntos de tasa E.A. */
  protected readonly escala = 30;

  protected readonly servicios = [
    {
      etiqueta: 'Disponible',
      titulo: 'Ranking por tasa real',
      texto:
        'Bancos, cooperativas y financieras ordenados por la tasa que de verdad cobran, no por la que anuncian.',
    },
    {
      etiqueta: 'Disponible',
      titulo: 'Simulador de cuota',
      texto:
        'Escribe el monto, el plazo y la tasa que te ofrecieron, y mira tu cuota y cuánto pagas en intereses.',
    },
    {
      etiqueta: 'Pronto',
      titulo: 'Comparador entre entidades',
      texto:
        'Elige dos entidades y te decimos cuánto te ahorras al mes y en todo el crédito si te cambias.',
    },
    {
      etiqueta: 'Pronto',
      titulo: 'Alertas de tasa',
      texto:
        'Te avisamos cuando baje la tasa del crédito que te interesa, para que pidas en el mejor momento.',
    },
  ];

  protected readonly pasos = [
    {
      titulo: 'Recogemos las tasas reales',
      texto:
        'Cada semana leemos lo que las entidades reportan a la Superintendencia Financiera sobre los créditos que desembolsan.',
    },
    {
      titulo: 'Las ponemos al lado de las anunciadas',
      texto:
        'Junto a cada tasa real ves la tasa "desde" que la entidad publica, para que veas la diferencia.',
    },
    {
      titulo: 'Calculas y decides',
      texto:
        'Comparas cuotas en pesos y llegas al banco sabiendo cuánto deberías pagar.',
    },
  ];
}
