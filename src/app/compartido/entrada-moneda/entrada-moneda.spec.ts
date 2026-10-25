import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EntradaMoneda, formatoMonto } from './entrada-moneda';

describe('formatoMonto', () => {
  it('pone puntos de miles mientras se escribe', () => {
    expect(formatoMonto('1')).toBe('1');
    expect(formatoMonto('1000')).toBe('1.000');
    expect(formatoMonto('1000000')).toBe('1.000.000');
    expect(formatoMonto('1.0000.00')).toBe('1.000.000');
    expect(formatoMonto('')).toBe('');
    expect(formatoMonto('$ 0025000')).toBe('25.000');
  });

  it('usa la coma para los centavos, con máximo dos', () => {
    expect(formatoMonto('1000000,')).toBe('1.000.000,');
    expect(formatoMonto('1000000,5')).toBe('1.000.000,5');
    expect(formatoMonto('1000000,509')).toBe('1.000.000,50');
    expect(formatoMonto('1000,5,6')).toBe('1.000,56');
    expect(formatoMonto(',5')).toBe('0,5');
  });
});

@Component({
  imports: [EntradaMoneda],
  template: `<input
    appMoneda
    [value]="texto()"
    (input)="texto.set($any($event.target).value)"
  />`,
})
class Prueba {
  readonly texto = signal('');
}

describe('EntradaMoneda', () => {
  function armar() {
    const fixture = TestBed.createComponent(Prueba);
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('input');
    document.body.appendChild(fixture.nativeElement);
    campo.focus();
    return { fixture, campo: campo as HTMLInputElement };
  }

  function teclear(campo: HTMLInputElement, tecla: string) {
    const fin = campo.value.length;
    campo.setRangeText(tecla, fin, fin, 'end');
    campo.dispatchEvent(
      new InputEvent('input', { data: tecla, inputType: 'insertText' }),
    );
  }

  it('el campo y la señal reciben el texto con puntos al teclear', () => {
    const { fixture, campo } = armar();
    for (const tecla of '1000000') teclear(campo, tecla);
    expect(campo.value).toBe('1.000.000');
    expect(fixture.componentInstance.texto()).toBe('1.000.000');
    expect(campo.selectionStart).toBe(9);
  });

  it('un punto tecleado se vuelve la coma de los centavos', () => {
    const { campo } = armar();
    for (const tecla of '2500.5') teclear(campo, tecla);
    expect(campo.value).toBe('2.500,5');
  });

  it('al salir completa los centavos o quita la coma suelta', () => {
    const { fixture, campo } = armar();
    for (const tecla of '2500,5') teclear(campo, tecla);
    campo.dispatchEvent(new Event('blur'));
    expect(campo.value).toBe('2.500,50');
    expect(fixture.componentInstance.texto()).toBe('2.500,50');

    campo.value = '3.000,';
    campo.dispatchEvent(new Event('blur'));
    expect(campo.value).toBe('3.000');
  });
});
