import {
  booleanAttribute,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';

const MILES = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Pone el texto de un monto a la colombiana: puntos de miles y coma para los
 * centavos (máximo dos). "1000000" → "1.000.000"; "1000000,5" → "1.000.000,5".
 */
export function formatoMonto(texto: string): string {
  const limpio = texto.replace(/[^\d,]/g, '');
  const coma = limpio.indexOf(',');
  const entero = (coma < 0 ? limpio : limpio.slice(0, coma)).replace(
    /^0+(?=\d)/,
    '',
  );
  const miles = entero.replace(MILES, '.');
  if (coma < 0) return miles;
  const centavos = limpio
    .slice(coma + 1)
    .replace(/,/g, '')
    .slice(0, 2);
  return `${miles || '0'},${centavos}`;
}

/** Cuántos dígitos y comas hay antes de la posición dada. */
function utiles(texto: string, hasta: number): number {
  return texto.slice(0, hasta).replace(/[^\d,]/g, '').length;
}

/**
 * Campo de monto que se escribe con puntos de miles mientras la persona
 * teclea, y coma para los centavos. Como los puntos los pone solo, un punto
 * tecleado se toma como la coma de los centavos (hay teclados de celular que
 * solo traen punto). Escucha en captura, así `(input)`, `[value]` y los
 * formularios reactivos ya reciben el texto con puntos. El campo lleva
 * `inputmode="decimal"` para que el teclado del celular traiga la coma.
 */
@Directive({ selector: 'input[appMoneda]' })
export class EntradaMoneda {
  readonly activo = input(true, {
    alias: 'appMoneda',
    transform: booleanAttribute,
  });

  constructor() {
    const campo =
      inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    const alEscribir = (evento: Event) => {
      if (this.activo()) this.formatear(campo, evento as InputEvent);
    };
    const alSalir = () => {
      if (this.activo()) this.completar(campo);
    };
    campo.addEventListener('input', alEscribir, true);
    campo.addEventListener('blur', alSalir);
    inject(DestroyRef).onDestroy(() => {
      campo.removeEventListener('input', alEscribir, true);
      campo.removeEventListener('blur', alSalir);
    });
  }

  private formatear(campo: HTMLInputElement, evento: InputEvent): void {
    let texto = campo.value;
    let cursor = campo.selectionStart ?? texto.length;
    if (evento.data === '.' && !texto.slice(0, cursor - 1).includes(',')) {
      texto = texto.slice(0, cursor - 1) + ',' + texto.slice(cursor);
    }
    const nuevo = formatoMonto(texto);
    if (nuevo === campo.value) return;

    // El cursor queda después de los mismos dígitos que tenía antes.
    const meta = utiles(texto, cursor);
    cursor = 0;
    while (cursor < nuevo.length && utiles(nuevo, cursor) < meta) cursor++;
    campo.value = nuevo;
    if (document.activeElement === campo) {
      campo.setSelectionRange(cursor, cursor);
    }
  }

  /** Al salir: sin coma suelta al final y con dos centavos si los hay. */
  private completar(campo: HTMLInputElement): void {
    const [entero, centavos] = campo.value.split(',');
    if (centavos === undefined) return;
    const nuevo =
      centavos === '' || /^0+$/.test(centavos)
        ? entero
        : `${entero},${centavos.padEnd(2, '0')}`;
    if (nuevo === campo.value) return;
    campo.value = nuevo;
    campo.dispatchEvent(new Event('input'));
  }
}
