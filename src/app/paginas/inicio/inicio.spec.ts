import { TASAS_DE_PRUEBA } from '../../core/datos/tasas-prueba';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TasasService } from '../../core/servicios/tasas.service';
import { Inicio } from './inicio';

describe('Inicio', () => {
  function crear() {
    registerLocaleData(localeEsCo);
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        TASAS_DE_PRUEBA,
      ],
    });
    fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  let fixture: ComponentFixture<Inicio>;

  /** Entidades de las tarjetas, en orden. */
  function tarjetas(html: HTMLElement): string[] {
    return [...html.querySelectorAll('.banco h3')].map((h) =>
      h.textContent!.trim(),
    );
  }

  function titulo(html: HTMLElement): string {
    return html
      .querySelector('#tituloTop')!
      .textContent!.replace(/\s+/g, ' ')
      .trim();
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
    expect(html.querySelector('.primero .destacado')?.textContent).toContain(
      'Mejor tasa',
    );
    // Cada tarjeta trae lo que cobra, la cuota de ejemplo y el rango.
    const primera = html.querySelector('.primero')!;
    expect(primera.querySelector('.cobra')?.textContent).toContain(
      'Cuota de $',
    );
    expect(primera.querySelector('.total')?.textContent).toContain(
      'Pagarías en total $',
    );
    expect(primera.querySelector('.total')?.textContent).toContain(
      'de intereses $',
    );
    expect(primera.querySelector('.detalle')?.textContent).toContain('Anuncia');
    // La diferencia se explica en palabras y con un globo de ayuda.
    expect(primera.querySelector('.dif-texto')?.textContent).toMatch(
      /(más|menos) de lo que\s+anuncia/,
    );
    expect(primera.querySelector('#tipDiferencia0')?.textContent).toContain(
      'cobra en promedio menos la tasa más baja',
    );
    expect(
      html.querySelector<HTMLAnchorElement>('.top-cabeza .nota a')?.href,
    ).toContain('datos.gov.co');
    expect(
      primera.querySelector<HTMLAnchorElement>('.quiero')?.getAttribute('href'),
    ).toContain('origen=inicio');
  });

  it('enlaza el PDF del banco o, si no publica PDF, su página de tasas', () => {
    const pies = [...crear().querySelectorAll('.banco-pie a:first-child')].map(
      (a) => a.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(pies[0]).toBe('PDF del banco ↗');
    expect(pies[1]).toBe('Tasas en la página del banco ↗');
  });

  it('las 3 tasas más bajas tienen una pestaña por producto', () => {
    const html = crear();
    const pestanas = [...html.querySelectorAll('.pestana')].map((b) =>
      b.textContent!.trim(),
    );
    expect(pestanas[0]).toBe('Libre inversión');
    expect(pestanas).toContain('Libranza');
    expect(titulo(html)).toBe('Las 3 tasas más bajas en libre inversión');
    // Al tocar Libranza se ven las 3 de libranza.
    [...html.querySelectorAll<HTMLButtonElement>('.pestana')]
      .find((b) => b.textContent!.trim() === 'Libranza')!
      .click();
    fixture.detectChanges();
    expect(titulo(html)).toBe('Las 3 tasas más bajas en libranza');
    const esperados = TestBed.inject(TasasService)
      .ranking('libranza')
      .slice(0, 3)
      .map((t) => t.entidad);
    expect(tarjetas(html)).toEqual(esperados);
    expect(
      html.querySelector('.pestana[aria-selected="true"]')!.textContent,
    ).toContain('Libranza');
    expect(
      html
        .querySelector<HTMLAnchorElement>('.top-cabeza > a')!
        .getAttribute('href'),
    ).toContain('producto=libranza');
  });

  it('pasa sola al siguiente producto cada 10 segundos y se puede pausar', async () => {
    jasmine.clock().install();
    try {
      const html = crear();
      await fixture.whenStable();
      const segundo = html.querySelectorAll('.pestana')[1].textContent!.trim();
      jasmine.clock().tick(10_000);
      fixture.detectChanges();
      expect(
        html
          .querySelector('.pestana[aria-selected="true"]')!
          .textContent!.trim(),
      ).toBe(segundo);
      // En pausa no cambia.
      html.querySelector<HTMLButtonElement>('.pausa')!.click();
      fixture.detectChanges();
      jasmine.clock().tick(30_000);
      fixture.detectChanges();
      expect(
        html
          .querySelector('.pestana[aria-selected="true"]')!
          .textContent!.trim(),
      ).toBe(segundo);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('no muestra el simulador', () => {
    expect(crear().querySelector('app-simulador')).toBeNull();
  });
});
