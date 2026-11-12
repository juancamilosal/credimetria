import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Encabezado } from './encabezado';

describe('Encabezado', () => {
  it('el menú lleva a ranking, simulador, compara tu oferta, aliados y asesoría', () => {
    TestBed.configureTestingModule({
      imports: [Encabezado],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Encabezado);
    fixture.detectChanges();
    const enlaces = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ].map((a) => a.textContent!.trim());
    expect(enlaces).toContain('Compara tu oferta');
    // "Aliados" pasó al pie de página para que el menú no quede cargado.
    expect(enlaces).not.toContain('Aliados');
    expect(enlaces).toContain('Créditos para reportados');
    const reportes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ].find((a) => a.textContent?.trim() === 'Créditos para reportados');
    expect(reportes?.classList).toContain('enlace-reportes');
    expect(enlaces).toContain('Asesoría gratis');
    // "Cómo funciona" solo llevaba a una parte del inicio (10 nov 2026).
    expect(enlaces).not.toContain('Cómo funciona');
  });
});
