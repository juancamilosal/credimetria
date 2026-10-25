import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

/** Clave en localStorage; `index.html` la lee antes de que cargue Angular. */
export const CLAVE_TEMA = 'credimetria-tema';

/**
 * Modo claro u oscuro elegido por la persona. Arranca en claro y recuerda la
 * elección en el navegador. El tema se aplica con `data-theme` en `<html>`.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tema = signal<Tema>(this.leerGuardado());

  constructor() {
    // En el servidor la página sale en claro (data-theme de index.html).
    if (!this.enNavegador) return;
    effect(() => {
      const tema = this.tema();
      this.documento.documentElement.setAttribute(
        'data-theme',
        tema === 'oscuro' ? 'dark' : 'light',
      );
      try {
        localStorage.setItem(CLAVE_TEMA, tema);
      } catch {
        // Sin almacenamiento (modo privado): el tema dura solo esta visita.
      }
    });
  }

  alternar(): void {
    this.tema.update((t) => (t === 'claro' ? 'oscuro' : 'claro'));
  }

  private leerGuardado(): Tema {
    if (!this.enNavegador) return 'claro';
    try {
      return localStorage.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
    } catch {
      return 'claro';
    }
  }
}
