import { Component } from '@angular/core';
import { Logo } from '../logo/logo';

@Component({
  selector: 'app-pie',
  imports: [Logo],
  templateUrl: './pie.html',
  styleUrl: './pie.css',
})
export class Pie {
  protected readonly anio = new Date().getFullYear();
}
