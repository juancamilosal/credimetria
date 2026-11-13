import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Encabezado } from './compartido/encabezado/encabezado';
import { AvisoCookies } from './compartido/aviso-cookies/aviso-cookies';
import { Pie } from './compartido/pie/pie';
import { AnaliticaService } from './core/servicios/analitica.service';
import { SeoService } from './core/servicios/seo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Encabezado, Pie, AvisoCookies],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    // Descripción, canonical, Open Graph y Twitter de cada página.
    inject(SeoService).iniciar();
    // Google Analytics solo con las cookies aceptadas (aviso abajo).
    const analitica = inject(AnaliticaService);
    afterNextRender(() => analitica.iniciar());
  }
}
