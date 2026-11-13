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
    // Compara tu oferta quedó dentro del simulador.
    expect(enlaces).not.toContain('Compara tu oferta');
    expect(enlaces).toContain('Simulador');
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

  it('el ícono del menú pasa de rayas a X y el menú se marca como abierto', () => {
    TestBed.configureTestingModule({
      imports: [Encabezado],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(Encabezado);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const boton = html.querySelector<HTMLButtonElement>('.btn-menu')!;
    expect(html.querySelector('.rayas.x')).toBeNull();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    boton.click();
    fixture.detectChanges();
    expect(html.querySelector('.rayas.x')).not.toBeNull();
    expect(html.querySelector('#menu.abierto')).not.toBeNull();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-label')).toBe('Cerrar menú');
  });
});
