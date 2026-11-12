import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Encabezado } from './compartido/encabezado/encabezado';
import { Pie } from './compartido/pie/pie';
import { SeoService } from './core/servicios/seo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Encabezado, Pie],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    // Descripción, canonical, Open Graph y Twitter de cada página.
    inject(SeoService).iniciar();
  }
}
