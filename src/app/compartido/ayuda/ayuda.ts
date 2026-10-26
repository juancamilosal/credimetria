import { Component, input, signal } from '@angular/core';

/**
 * Botón "?" con un globo que explica algo. Se abre al pasar el mouse, con el
 * teclado o al tocarlo (celular). `globo` es el id del globo, para
 * `aria-describedby`; debe ser único en la página.
 */
@Component({
  selector: 'app-ayuda',
  templateUrl: './ayuda.html',
  styleUrl: './ayuda.css',
  host: { '[class.abajo]': "lado() === 'abajo'" },
})
export class Ayuda {
  readonly texto = input.required<string>();
  /** Lo que lee el lector de pantalla en el botón: "Qué es…". */
  readonly etiqueta = input.required<string>();
  readonly globo = input.required<string>();
  /** Dónde sale el globo; abajo para no quedar cortado arriba. */
  readonly lado = input<'arriba' | 'abajo'>('arriba');

  protected readonly abierta = signal(false);
}
