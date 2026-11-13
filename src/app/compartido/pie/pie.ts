import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnaliticaService } from '../../core/servicios/analitica.service';
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
  protected readonly analitica = inject(AnaliticaService);
}
