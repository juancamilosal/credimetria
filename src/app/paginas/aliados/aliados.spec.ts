import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ALEXANDRA, servicioFalso } from '../../core/datos/aliados-prueba';
import { Aliado } from '../../core/modelos/aliado';
import { AliadosService } from '../../core/servicios/aliados.service';
import { Aliados } from './aliados';

describe('Aliados', () => {
  function crear(lista: Aliado[] = [ALEXANDRA], sinConexion = false) {
    TestBed.configureTestingModule({
      imports: [Aliados],
      providers: [
        provideRouter([]),
        {
          provide: AliadosService,
          useValue: servicioFalso(lista, sinConexion),
        },
      ],
    });
    const fixture = TestBed.createComponent(Aliados);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los asesores de Directus con su foto, bancos, productos y ciudades', () => {
    const html = crear();
    const tarjeta = html.querySelector('.aliado:not(.vacio)')!;
    expect(tarjeta.textContent).toContain('Alexandra Rojas García');
    expect(tarjeta.textContent).toContain('Fuerza de ventas');
    expect(tarjeta.textContent).toContain('Verificado por Credimetría');
    expect(tarjeta.querySelectorAll('.chip').length).toBe(8);
    expect(tarjeta.textContent).toContain('Riohacha');
    const foto = tarjeta.querySelector<HTMLImageElement>('img.foto')!;
    expect(foto.getAttribute('src')).toBe(
      '/api/asesores/alexandra-rojas-garcia/foto',
    );
    expect(foto.alt).toBe('Foto de Alexandra Rojas García');
    expect(html.querySelector('.proximamente')).toBeNull();
    expect(html.textContent).toContain('¿Eres asesor de crédito?');
  });

  it('"Reportar un asesor" abre el formulario, y cada tarjeta lo abre con su asesor', () => {
    const html = crear();
    const boton = [...html.querySelectorAll('a')].find(
      (a) => a.textContent?.trim() === 'Reportar un asesor',
    )!;
    expect(boton.getAttribute('href')).toBe('/aliados/reportar');
    expect(html.querySelector('.reportar-este')?.getAttribute('href')).toBe(
      '/aliados/reportar?asesor=alexandra-rojas-garcia',
    );
  });

  it('sin asesores publicados dice "Próximamente tus asesores"', () => {
    const html = crear([]);
    expect(html.querySelector('.proximamente')?.textContent).toContain(
      'Próximamente tus asesores',
    );
  });

  it('si Directus no responde lo dice', () => {
    const html = crear([], true);
    expect(html.textContent).toContain('No pudimos cargar los asesores');
    expect(html.textContent).not.toContain('Próximamente tus asesores');
  });
});
