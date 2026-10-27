import { Component, input } from '@angular/core';
import { ICONO } from './trazos';

/**
 * Marca de Credimetría: la C de medidor con dos barras y el nombre en dos
 * colores ("Credi" azul, "metría" verde). Los colores salen de
 * `--cm-logo-azul` y `--cm-logo-verde`, que cambian en modo oscuro.
 */
@Component({
  selector: 'app-logo',
  template: `
    <svg
      [attr.height]="tamano()"
      [attr.width]="(tamano() * icono.ancho) / icono.alto"
      [attr.viewBox]="'0 0 ' + icono.ancho + ' ' + icono.alto"
      aria-hidden="true"
    >
      <path
        fill="var(--cm-logo-azul)"
        fill-rule="evenodd"
        [attr.d]="icono.azul"
      />
      <path
        fill="var(--cm-logo-verde)"
        fill-rule="evenodd"
        [attr.d]="icono.verde"
      />
    </svg>
    <span class="nombre">Credi<span class="verde">metría</span></span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .nombre {
      color: var(--cm-logo-azul);
      font-weight: 800;
      font-size: var(--tamano-nombre, 22px);
      letter-spacing: -0.035em;
      line-height: 1;
    }
    .verde {
      color: var(--cm-logo-verde);
    }
  `,
})
export class Logo {
  /** Alto del ícono en píxeles. */
  readonly tamano = input(34);
  protected readonly icono = ICONO;
}
