import { TestBed } from '@angular/core/testing';
import { CLAVE_TEMA, TemaService } from './tema.service';

describe('TemaService', () => {
  afterEach(() => {
    localStorage.removeItem(CLAVE_TEMA);
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('arranca en claro y cambia a oscuro', () => {
    const servicio = TestBed.inject(TemaService);
    TestBed.tick();
    expect(servicio.tema()).toBe('claro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    servicio.alternar();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');
  });

  it('recuerda el tema elegido', () => {
    localStorage.setItem(CLAVE_TEMA, 'oscuro');
    const servicio = TestBed.inject(TemaService);
    expect(servicio.tema()).toBe('oscuro');
  });
});
