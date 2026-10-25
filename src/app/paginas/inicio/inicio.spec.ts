import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TasasService } from '../../core/servicios/tasas.service';
import { Inicio } from './inicio';

describe('Inicio', () => {
  function crear() {
    registerLocaleData(localeEsCo);
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'es-CO' }],
    });
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dice qué hace Credimetría', () => {
    expect(crear().querySelector('h1')?.textContent).toContain(
      'Compara con datos, no con promesas',
    );
  });

  it('muestra los 3 bancos que menos cobran en libre inversión', () => {
    const html = crear();
    const nombres = [...html.querySelectorAll('.banco h3')].map((h) =>
      h.textContent?.trim(),
    );
    const esperados = TestBed.inject(TasasService)
      .ranking('libre-inversion')
      .slice(0, 3)
      .map((t) => t.entidad);
    expect(nombres).toEqual(esperados);
    expect(html.querySelector('.primero .mejor')?.textContent).toContain(
      'Mejor tasa',
    );
  });

  it('no muestra el simulador', () => {
    expect(crear().querySelector('app-simulador')).toBeNull();
  });
});
