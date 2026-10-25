import { Component, input, model } from '@angular/core';

export interface OpcionChip {
  valor: string;
  texto: string;
}

/**
 * Grupo de opciones donde solo una queda elegida (aria-pressed).
 * Variantes: `redondo` (productos), `cuadrado` (tipo de entidad),
 * `uva` (producto en la asesoría) y `urgencia` (Ya, Este mes, En 3 meses).
 */
@Component({
  selector: 'app-chips',
  template: `
    @for (opcion of opciones(); track opcion.valor) {
      <button
        type="button"
        [attr.aria-pressed]="opcion.valor === valor()"
        (click)="valor.set(opcion.valor)"
      >
        {{ opcion.texto }}
      </button>
    }
  `,
  styleUrl: './chips.css',
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'etiqueta()',
    '[class]': 'variante()',
  },
})
export class Chips {
  readonly opciones = input.required<OpcionChip[]>();
  readonly valor = model.required<string>();
  readonly variante = input<'redondo' | 'cuadrado' | 'uva' | 'urgencia'>(
    'redondo',
  );
  /** Id del texto que nombra el grupo. */
  readonly etiqueta = input<string | null>(null);
}
