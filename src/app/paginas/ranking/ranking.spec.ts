import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ranking } from './ranking';

describe('Ranking', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [Ranking],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Ranking);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return [
      ...html.querySelectorAll<HTMLButtonElement>('app-chips button'),
    ].find((b) => b.textContent?.trim() === texto)!;
  }

  it('muestra libre inversión ordenada con AV Villas primero', () => {
    const { html } = crear();
    expect(html.querySelector('caption')?.textContent).toContain(
      'Libre inversión · 7 entidades',
    );
    expect(
      html.querySelector('tbody tr td:nth-child(2)')?.textContent,
    ).toContain('AV Villas');
  });

  it('filtra por tipo y vuelve a numerar desde 1', () => {
    const { fixture, html } = crear();
    boton(html, 'Cooperativa').click();
    fixture.detectChanges();
    const filas = html.querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
    expect(filas[0].querySelector('.pos')?.textContent?.trim()).toBe('1');
    expect(filas[0].textContent).toContain('Confiar');
  });

  it('una entidad sin tasa anunciada muestra "—"', () => {
    const { html } = crear();
    const bogota = [...html.querySelectorAll('tbody tr')].find((f) =>
      f.textContent?.includes('Banco de Bogotá'),
    )!;
    expect(bogota.querySelectorAll('td')[3].textContent?.trim()).toBe('—');
  });
});
