import { Component, input } from '@angular/core';

/** Marca de Credimetría: cuadrado azul con barras blancas que crecen. */
@Component({
  selector: 'app-logo',
  template: `
    <svg
      [attr.width]="tamano()"
      [attr.height]="tamano()"
      viewBox="0 0 34 34"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="32"
        height="32"
        rx="8"
        fill="var(--cm-marca-700)"
      />
      <path
        d="M7 24h20M9 24v-4M13 24v-7M17 24v-10M21 24v-6M25 24v-3"
        stroke="#FFFFFF"
        stroke-width="2.2"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
    <span>Credimetría</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 21px;
      letter-spacing: -0.02em;
    }
  `,
})
export class Logo {
  readonly tamano = input(34);
}
