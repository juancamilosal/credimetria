import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ALIADOS } from '../../core/datos/aliados';
import { AliadosService } from '../../core/servicios/aliados.service';
import { Aliados } from './aliados';

describe('Aliados', () => {
  function crear(lista = ALIADOS) {
    TestBed.configureTestingModule({
      imports: [Aliados],
      providers: [
        provideRouter([]),
        {
          provide: AliadosService,
          useValue: { ejemplo: lista.length === 0, lista: () => lista },
        },
      ],
    });
    const fixture = TestBed.createComponent(Aliados);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra a Alexandra Rojas García con su foto, bancos, productos y ciudades', () => {
    const html = crear();
    const tarjeta = html.querySelector('.aliado:not(.vacio)')!;
    expect(tarjeta.textContent).toContain('Alexandra Rojas García');
    expect(tarjeta.textContent).toContain('Fuerza de ventas');
    expect(tarjeta.textContent).toContain('Verificado por Credimetría');
    expect(tarjeta.querySelectorAll('.chip').length).toBe(34);
    expect(tarjeta.textContent).toContain('Riohacha');
    expect(tarjeta.textContent).toContain('GNB Sudameris');
    expect(tarjeta.textContent).toContain('Préstamos con reportes');
    expect(tarjeta.textContent).toContain('Pasto');
    const foto = tarjeta.querySelector<HTMLImageElement>('img.foto')!;
    expect(foto.getAttribute('src')).toBe(
      '/aliados/alexandra-rojas-garcia.webp',
    );
    expect(foto.alt).toBe('Foto de Alexandra Rojas García');
    expect(html.querySelector('.proximamente')).toBeNull();
    expect(html.textContent).toContain('¿Eres asesor de crédito?');
  });

  it('sin aliados dice "Próximamente tus asesores"', () => {
    const html = crear([]);
    expect(html.querySelector('.proximamente')?.textContent).toContain(
      'Próximamente tus asesores',
    );
    expect(html.textContent).not.toContain('Versión de prueba');
  });
});
