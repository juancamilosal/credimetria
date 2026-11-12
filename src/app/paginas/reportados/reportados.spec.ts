import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  ENTIDADES_REPORTADOS,
  ENTIDADES_VISIBLES,
} from '../../core/datos/entidades-reportados';
import { Reportados } from './reportados';

describe('Reportados', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [Reportados],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Reportados);
    fixture.detectChanges();
    return fixture;
  }

  function botones(html: HTMLElement, texto: string): HTMLButtonElement {
    return [
      ...html.querySelectorAll<HTMLButtonElement>('app-chips button'),
    ].find((b) => b.textContent?.trim() === texto)!;
  }

  it('muestra las vigiladas y las operadoras en dos grupos, sin tasas', () => {
    const html = crear().nativeElement as HTMLElement;
    expect(html.querySelectorAll('.entidad.nivel-1').length).toBe(1);
    expect(html.querySelectorAll('.entidad.nivel-2').length).toBe(3);
    expect(html.textContent).toContain('Inscrita en el RUNEOL');
    expect(html.textContent).toContain(
      'Vigilada por la Superintendencia Financiera',
    );
    expect(html.textContent).not.toMatch(/E\.A\.|%/);
    expect(html.querySelectorAll('.presta').length).toBe(
      ENTIDADES_VISIBLES.length,
    );
  });

  it('cada entidad lleva su ficha del registro y la asesoría con su nombre', () => {
    const html = crear().nativeElement as HTMLElement;
    const vantage = [...html.querySelectorAll('.entidad')].find((t) =>
      t.querySelector('h3')?.textContent?.includes('Vantage'),
    )!;
    expect(vantage.querySelector('.ficha')?.textContent).toContain('900690783');
    const asesoria = vantage.querySelector('a.btn-principal')!;
    expect(asesoria.getAttribute('href')).toBe(
      '/asesoria?origen=reportados&entidad=Vantage',
    );
    expect(vantage.querySelector('a.btn-borde')?.getAttribute('href')).toBe(
      'https://runeol.rues.org.co/',
    );
  });

  it('BIV muestra que su registro está por confirmar', () => {
    const html = crear().nativeElement as HTMLElement;
    expect(html.querySelectorAll('.por-confirmar').length).toBe(1);
    expect(html.querySelector('.por-confirmar')?.textContent).toContain(
      'Marsof BIV',
    );
  });

  it('filtra por tipo y por especialidad', () => {
    const fixture = crear();
    const html = fixture.nativeElement as HTMLElement;
    botones(html, 'Operadoras de libranza').click();
    fixture.detectChanges();
    expect(html.querySelectorAll('.entidad.nivel-1').length).toBe(0);
    expect(html.querySelectorAll('.entidad.nivel-2').length).toBe(3);

    botones(html, 'Pensionados').click();
    fixture.detectChanges();
    const nombres = [...html.querySelectorAll('.entidad h3')].map((h) =>
      h.textContent?.trim(),
    );
    expect(nombres).toEqual(['Kala', 'BIV']);
  });

  it('no muestra las entidades ocultas ni sus especialidades', () => {
    const html = crear().nativeElement as HTMLElement;
    expect(
      ENTIDADES_REPORTADOS.find((e) => e.id === 'mission')?.oculta,
    ).toBeTruthy();
    const nombres = [...html.querySelectorAll('.entidad h3')].map((h) =>
      h.textContent?.trim(),
    );
    expect(nombres).not.toContain('Mission');
    expect(botones(html, 'Policía y Fuerzas Militares')).toBeUndefined();
  });

  it('con logo muestra la imagen; sin logo, las iniciales', () => {
    const koa = ENTIDADES_REPORTADOS.find((e) => e.id === 'koa')!;
    const antes = koa.logo;
    koa.logo = '/logos-entidades/koa.webp';
    try {
      const html = crear().nativeElement as HTMLElement;
      const img = html.querySelector<HTMLImageElement>('.entidad img.logo')!;
      expect(img.getAttribute('src')).toBe('/logos-entidades/koa.webp');
      expect(img.alt).toBe('Logo de Koa');
      const conLogo = ENTIDADES_VISIBLES.filter((e) => e.logo).length;
      expect(html.querySelectorAll('img.logo').length).toBe(conLogo);
      expect(html.querySelectorAll('.iniciales').length).toBe(
        ENTIDADES_VISIBLES.length - conLogo,
      );
    } finally {
      koa.logo = antes;
    }
  });
});
