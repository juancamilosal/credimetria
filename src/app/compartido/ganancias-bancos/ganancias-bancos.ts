import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinancierosService } from '../../core/servicios/financieros.service';
import {
  cambio,
  periodoDelAnio,
  pesosGrandes,
  porcentaje,
} from '../../core/utilidades/financieros';

/**
 * Inicio: "¿Cuánto ganan los bancos?", los 3 bancos que más ganaron en lo
 * que va del año según el CUIF, con enlace a /estados-financieros. Si las
 * cifras no llegan, la sección no aparece.
 */
@Component({
  selector: 'app-ganancias-bancos',
  imports: [RouterLink],
  templateUrl: './ganancias-bancos.html',
  styleUrl: './ganancias-bancos.css',
})
export class GananciasBancos {
  private readonly servicio = inject(FinancierosService);

  protected readonly pesos = pesosGrandes;
  protected readonly cambio = cambio;
  protected readonly porcentaje = porcentaje;

  /** Solo bancos (no financieras ni cooperativas), los 3 que más ganan. */
  protected readonly top = computed(() =>
    (this.servicio.datos()?.entidades ?? [])
      .filter((e) => !e.tipo || e.tipo === 'Banco')
      .slice(0, 3),
  );
  protected readonly periodo = computed(() => {
    const corte = this.servicio.datos()?.corte;
    return corte ? periodoDelAnio(corte) : '';
  });

  constructor() {
    this.servicio.cargar();
  }
}
