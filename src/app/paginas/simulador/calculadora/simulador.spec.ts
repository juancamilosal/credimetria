import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Simulador } from './simulador';

describe('Simulador', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [Simulador],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Simulador);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function escribir(input: HTMLInputElement, valor: string) {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  it('con los valores por defecto da $648.087, $604.529 y $2.090.784', () => {
    const { html } = crear();
    expect(html.querySelector('.grande')?.textContent).toContain('$648.087');
    expect(html.querySelector('.media')?.textContent).toContain('$604.529');
    expect(html.querySelector('.ahorro')?.textContent).toContain('$2.090.784');
    expect(html.querySelector('.ahorro')?.textContent).toContain(
      '$43.558 menos al mes',
    );
  });

  it('dice "¡Buena tasa!" si la tasa es igual o menor que la mejor', () => {
    const { fixture, html } = crear();
    escribir(html.querySelector<HTMLInputElement>('#simTasa')!, '21,00');
    fixture.detectChanges();
    expect(html.querySelector('.ahorro')).toBeNull();
    expect(html.textContent).toContain('¡Buena tasa!');
  });

  it('avisa si la tasa supera la de usura', () => {
    const { fixture, html } = crear();
    escribir(html.querySelector<HTMLInputElement>('#simTasa')!, '35');
    fixture.detectChanges();
    expect(html.querySelector('#avisoUsura')).not.toBeNull();
  });

  it('pide monto y tasa si faltan', () => {
    const { fixture, html } = crear();
    escribir(html.querySelector<HTMLInputElement>('#simMonto')!, '');
    fixture.detectChanges();
    expect(html.querySelector('.grande')?.textContent).toContain('—');
    expect(html.textContent).toContain('Escribe el monto y la tasa');
  });
});
