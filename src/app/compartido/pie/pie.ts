import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TasasService } from '../../core/servicios/tasas.service';

@Component({
  selector: 'app-pie',
  imports: [RouterLink],
  templateUrl: './pie.html',
  styleUrl: './pie.css',
})
export class Pie {
  protected readonly ejemplo = inject(TasasService).corte.ejemplo;
}
