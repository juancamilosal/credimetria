import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { entidadDePrueba } from '../../core/datos/financieros-prueba';
import { DatosFinancieros } from '../../core/modelos/financiero';
import { FINANCIEROS_INICIALES } from '../../core/servicios/financieros.service';
import { EstadosFinancieros } from './estados-financieros';

const MM = 1e9;

function datosDePrueba(): DatosFinancieros {
  const davivienda = entidadDePrueba();
  davivienda.logo = '/api/logos/davivienda';
  const bbva = entidadDePrueba({
    utilidad: -50 * MM,
    utilidadAnterior: 20 * MM,
    variacionUtilidad: -3.5,
    rentabilidad: -0.01,
  });
  bbva.codigo = 'bbva';
  bbva.nombre = 'BBVA Colombia';
  bbva.anual = [
    { anio: 2024, utilidad: -369 * MM },
    { anio: 2025, utilidad: 458 * MM },
  ];
  bbva.analisis = {
    periodo: 'Junio 2026',
    titular: 'Provisiones altas en el semestre',
    puntos: [
      { tipo: 'alerta', texto: 'Subió la cartera vencida' },
      { tipo: 'fortaleza', texto: 'Solvencia por encima del mínimo' },
    ],
    paraTi: 'Sigue prestando con normalidad.',
    pdf: '/api/estados-financieros/bbva/pdf',
    actualizado: '2026-11-15',
  };
  return {
    fuente: 'Superintendencia Financiera de Colombia (CUIF)',
    consulta: 'https://www.datos.gov.co/d/mxk5-ce6w',
    corte: '2026-08-31',
    entidades: [davivienda, bbva],
  };
}

describe('EstadosFinancieros', () => {
  async function abrir(url = '/estados-financieros') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'estados-financieros', component: EstadosFinancieros },
        ]),
        provideHttpClient(),
        { provide: FINANCIEROS_INICIALES, useValue: datosDePrueba() },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, html: harness.routeNativeElement as HTMLElement };
  }

  it('lista las entidades con su utilidad y muestra la primera', async () => {
    const { html } = await abrir();
    const opciones = [...html.querySelectorAll('.opcion')];
    expect(opciones.length).toBe(2);
    expect(opciones[0].textContent).toContain('$1,6 bill.');
    expect(opciones[0].querySelector('.cambio.sube')?.textContent).toContain(
      '59 %',
    );
    expect(opciones[0].getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector('h1')?.textContent).toContain(
      '¿Cuánto ganan los bancos?',
    );
    expect(html.querySelector('.cabecera p')?.textContent).toContain(
      'agosto de 2026',
    );
    expect(html.querySelector('#t-entidad')?.textContent).toContain(
      'Davivienda',
    );
    expect(html.querySelector('.titular')?.textContent).toContain(
      'Ganó 59 % más que el año pasado',
    );
    expect(html.querySelector('.tendencia.mejora')).toBeTruthy();
    // 3 años completos y el año en curso, que va rayado.
    const barras = html.querySelectorAll('.grafica li');
    expect(barras.length).toBe(4);
    expect(barras[3].classList).toContain('en-curso');
    expect(barras[3].textContent).toContain('2026 (ene–ago)');
    // Sin análisis escrito: avisa que viene.
    expect(html.querySelector('.escrito')).toBeNull();
    expect(html.querySelector('.pronto')).toBeTruthy();
    expect(html.querySelector('.nota a')?.getAttribute('href')).toBe(
      'https://www.datos.gov.co/d/mxk5-ce6w',
    );
  });

  it('al elegir otra entidad la pone en la dirección y muestra su análisis y PDF', async () => {
    const { harness, html } = await abrir();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.callThrough();
    html.querySelectorAll<HTMLButtonElement>('.opcion')[1].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(navegar).toHaveBeenCalledWith([], {
      queryParams: { entidad: 'bbva' },
      replaceUrl: true,
    });
    expect(html.querySelector('#t-entidad')?.textContent).toContain('BBVA');
    expect(html.querySelector('.tendencia.empeora')).toBeTruthy();
    // La pérdida va hacia abajo, en ámbar.
    expect(html.querySelectorAll('.barra.negativa').length).toBe(2);
    const escrito = html.querySelector('.escrito')!;
    expect(escrito.textContent).toContain('Junio 2026');
    expect(escrito.textContent).toContain('Provisiones altas en el semestre');
    expect(escrito.querySelectorAll('.puntos li.alerta').length).toBe(1);
    expect(escrito.querySelector('.para-ti')?.textContent).toContain(
      'Sigue prestando con normalidad.',
    );
    const pdf = escrito.querySelector<HTMLAnchorElement>('a.btn')!;
    expect(pdf.getAttribute('href')).toBe('/api/estados-financieros/bbva/pdf');
    expect(pdf.target).toBe('_blank');
  });

  it('sin logo muestra iniciales que se entienden', async () => {
    const { html } = await abrir();
    // "BBVA Colombia" no tiene logo en los datos de prueba: "BC", no "B".
    expect(
      html.querySelectorAll('.opcion')[1].querySelector('.iniciales')
        ?.textContent,
    ).toBe('BC');
  });

  it('abre directo la entidad de la dirección', async () => {
    const { html } = await abrir('/estados-financieros?entidad=bbva');
    expect(html.querySelector('#t-entidad')?.textContent).toContain('BBVA');
  });
});
