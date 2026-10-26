import { TestBed } from '@angular/core/testing';
import { Ayuda } from './ayuda';

describe('Ayuda', () => {
  function crear(lado?: 'arriba' | 'abajo') {
    const fixture = TestBed.createComponent(Ayuda);
    fixture.componentRef.setInput('texto', 'Lo que significa');
    fixture.componentRef.setInput('etiqueta', 'Qué es esto');
    fixture.componentRef.setInput('globo', 'tipPrueba');
    if (lado) fixture.componentRef.setInput('lado', lado);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('describe el botón con el globo y lo abre al tocarlo', () => {
    const { fixture, html } = crear();
    const boton = html.querySelector('button')!;
    const globo = html.querySelector('#tipPrueba')!;
    expect(boton.getAttribute('aria-label')).toBe('Qué es esto');
    expect(boton.getAttribute('aria-describedby')).toBe('tipPrueba');
    expect(globo.getAttribute('role')).toBe('tooltip');
    expect(globo.textContent).toContain('Lo que significa');
    boton.click();
    fixture.detectChanges();
    expect(globo.classList).toContain('abierto');
    boton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(globo.classList).not.toContain('abierto');
  });

  it('puede salir abajo', () => {
    expect(crear('abajo').html.classList).toContain('abajo');
  });
});
