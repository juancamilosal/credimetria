import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';
import { TemaService } from '../../core/servicios/tema.service';
import { Logo } from '../logo/logo';

@Component({
  selector: 'app-encabezado',
  imports: [RouterLink, RouterLinkActive, Logo],
  templateUrl: './encabezado.html',
  styleUrl: './encabezado.css',
})
export class Encabezado {
  protected readonly menuAbierto = signal(false);
  protected readonly temas = inject(TemaService);

  /**
   * "Ir al contenido": con `<base href="/">` el enlace "#contenido" llevaría
   * a la portada; se pasa el foco al contenido de la página actual.
   */
  protected saltar(evento: Event): void {
    evento.preventDefault();
    const main = document.getElementById('contenido');
    main?.focus();
    main?.scrollIntoView();
  }

  constructor() {
    // El menú del celular se cierra al cambiar de página.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }
}
