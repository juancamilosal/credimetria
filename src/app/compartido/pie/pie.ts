import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FUENTE_PROMEDIO } from '../../core/datos/tasas';
import { TasasService } from '../../core/servicios/tasas.service';
import { Logo } from '../logo/logo';

@Component({
  selector: 'app-pie',
  imports: [RouterLink, Logo],
  templateUrl: './pie.html',
  styleUrl: './pie.css',
})
export class Pie {
  private readonly corte = inject(TasasService).corte;
  protected readonly ejemplo = computed(() => this.corte().ejemplo);
  /** Los datos de la Superfinanciera (se abren en otra pestaña). */
  protected readonly fuente = FUENTE_PROMEDIO;
}
