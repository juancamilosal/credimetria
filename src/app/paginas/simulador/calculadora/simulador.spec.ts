import { TASAS_DE_PRUEBA } from '../../../core/datos/tasas-prueba';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Simulador } from './simulador';

describe('Simulador', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [Simulador],
      providers: [provideRouter([]), TASAS_DE_PRUEBA],
    });
    const fixture = TestBed.createComponent(Simulador);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function marcarCuotaFija(
    fixture: { detectChanges(): void },
    html: HTMLElement,
  ) {
    html.querySelector<HTMLInputElement>('#simCuotaFija')!.click();
    fixture.detectChanges();
  }

  function escribir(input: HTMLInputElement, valor: string) {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  it('por defecto la cuota es decreciente: de $810.703 a $424.876', () => {
    const { html } = crear();
    expect(
      html.querySelector<HTMLInputElement>('#simCuotaFija')!.checked,
    ).toBeFalse();
    expect(html.querySelector('.grande')?.textContent).toContain('$810.703');
    expect(html.querySelector('.resultado')?.textContent).toContain(
      'Baja cada mes hasta $424.876',
    );
    expect(html.querySelector('.resultado')?.textContent).toContain(
      'Pagarías en total $29.653.893',
    );
    expect(html.querySelector('.ahorro')?.textContent).toContain('$1.643.800');
  });

  it('con "Cuota fija" marcada da $648.087, $604.529 y $2.090.784', () => {
    const { fixture, html } = crear();
    marcarCuotaFija(fixture, html);
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

  it('"Simular" muestra la tabla de amortización y sigue los cambios', () => {
    const { fixture, html } = crear();
    marcarCuotaFija(fixture, html);
    expect(html.querySelector('.amortizacion')).toBeNull();
    const boton = [...html.querySelectorAll('button')].find((b) =>
      b.textContent!.includes('Simular'),
    )!;
    boton.click();
    fixture.detectChanges();

    const filas = () => html.querySelectorAll('.amortizacion tbody tr');
    expect(filas().length).toBe(48);
    expect(filas()[0].textContent).toContain('$648.087');
    expect(
      filas()[47].querySelector('td:last-child')?.textContent?.trim(),
    ).toBe('$0');
    expect(html.querySelector('.totales')?.textContent).toContain(
      '$11.108.167',
    );

    const plazo = html.querySelector<HTMLSelectElement>('#simPlazo')!;
    plazo.value = '12';
    plazo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(filas().length).toBe(12);
  });

  it('explica la cuota fija en un globo de ayuda', () => {
    const { fixture, html } = crear();
    const boton = html.querySelector<HTMLButtonElement>(
      '[aria-describedby="tipCuotaFija"]',
    )!;
    const globo = html.querySelector('#tipCuotaFija')!;
    expect(globo.getAttribute('role')).toBe('tooltip');
    expect(globo.textContent).toContain('Sin marcar, la cuota baja cada mes');
    expect(globo.classList).not.toContain('abierto');
    boton.click();
    fixture.detectChanges();
    expect(globo.classList).toContain('abierto');
  });
});
