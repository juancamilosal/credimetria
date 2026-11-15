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
    { anio: 2024, utilidad: -369 * MM, patrimonio: null, cartera: null },
    { anio: 2025, utilidad: 458 * MM, patrimonio: null, cartera: null },
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

  it('sin banco elegido muestra solo la lista', async () => {
    const { html } = await abrir();
    const opciones = [...html.querySelectorAll('.opcion')];
    expect(opciones.length).toBe(2);
    expect(opciones[0].textContent).toContain('$1,6 bill.');
    expect(opciones[0].querySelector('.cambio.sube')?.textContent).toContain(
      '59 %',
    );
    expect(html.querySelector('h1')?.textContent).toContain(
      '¿Cuánto ganan los bancos y financieras?',
    );
    expect(html.querySelector('.cabecera p')?.textContent).toContain(
      'agosto de 2026',
    );
    expect(html.querySelector('.detalle')).toBeNull();
    expect(html.querySelector('.volver')).toBeNull();
    // Filtros por tipo, con cuántas hay (solo los tipos que existen).
    expect(
      [...html.querySelectorAll('.filtros-tipo button')].map((b) =>
        b.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['Todas 2', 'Bancos 2']);
  });

  it('al elegir un banco oculta la lista y muestra su ficha, con Volver', async () => {
    const { harness, html } = await abrir();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.callThrough();
    html.querySelectorAll<HTMLButtonElement>('.opcion')[0].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(navegar).toHaveBeenCalledWith([], {
      queryParams: { entidad: 'davivienda' },
    });
    expect(html.querySelector('.lista')).toBeNull();
    expect(html.querySelector('#t-entidad')?.textContent).toContain(
      'Davivienda',
    );
    expect(html.querySelector('.titular')?.textContent).toContain(
      'Ganó 59 % más que el año pasado',
    );
    // Ficha técnica de la Superfinanciera.
    const ficha = html.querySelector('.ficha')!;
    expect(ficha.textContent).toContain('Presidente');
    expect(ficha.textContent).toContain('Javier José Suárez Esparragoza');
    expect(ficha.textContent).toContain('860.034.313-7');
    expect(ficha.textContent).toContain('código 1-39');
    expect(ficha.textContent).toContain(
      'Banco vigilado por la Superintendencia',
    );
    expect(ficha.querySelector('a')?.getAttribute('href')).toBe(
      'https://www.davivienda.com',
    );
    // 3 años completos y el año en curso, que va rayado.
    const barras = html.querySelectorAll('.grafica li');
    expect(barras.length).toBe(4);
    expect(barras[3].classList).toContain('en-curso');
    // Sin análisis escrito: avisa que viene.
    expect(html.querySelector('.escrito')).toBeNull();
    expect(html.querySelector('.pronto')).toBeTruthy();

    html.querySelector<HTMLButtonElement>('.volver')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(html.querySelector('.detalle')).toBeNull();
    expect(html.querySelectorAll('.opcion').length).toBe(2);
  });

  it('compara con líneas: por defecto con los que más ganan, se cambia la métrica y se marcan casillas', async () => {
    const { harness, html } = await abrir('/estados-financieros?entidad=bbva');
    // BBVA se compara con Davivienda (la otra de la lista).
    expect(html.querySelectorAll('svg.lineas .serie').length).toBe(2);
    expect(
      [...html.querySelectorAll('.leyenda-lineas b')].map((b) => b.textContent),
    ).toEqual(['BBVA Colombia', 'Davivienda']);
    const rent = [
      ...html.querySelectorAll<HTMLButtonElement>('.metricas button'),
    ].find((b) => b.textContent?.includes('Rentabilidad'))!;
    rent.click();
    harness.detectChanges();
    expect(rent.getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector('svg.lineas .eje')?.textContent).toContain('%');
    // BBVA no tiene patrimonio en los datos de prueba: solo Davivienda.
    expect(html.querySelectorAll('svg.lineas .serie circle').length).toBe(3);
    html.querySelector<HTMLButtonElement>('.metricas button')!.click();
    harness.detectChanges();
    // Casillas: Davivienda viene marcada; al desmarcarla queda solo BBVA.
    const casilla = () =>
      html.querySelector<HTMLInputElement>('.casillas input')!;
    expect(casilla().checked).toBeTrue();
    casilla().click();
    harness.detectChanges();
    expect(casilla().checked).toBeFalse();
    expect(html.querySelectorAll('svg.lineas .serie').length).toBe(1);
    // Se vuelve a marcar, y "Ninguno" / "Todos".
    casilla().click();
    harness.detectChanges();
    expect(html.querySelectorAll('svg.lineas .serie').length).toBe(2);
    const [todos, ninguno] = html.querySelectorAll<HTMLButtonElement>(
      '.acciones-casillas button',
    );
    ninguno.click();
    harness.detectChanges();
    expect(html.querySelectorAll('svg.lineas .serie').length).toBe(1);
    todos.click();
    harness.detectChanges();
    expect(html.querySelectorAll('svg.lineas .serie').length).toBe(2);
  });

  it('muestra el análisis escrito y el PDF', async () => {
    const { html } = await abrir('/estados-financieros?entidad=bbva');
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
    expect(html.querySelector('.nota a')?.getAttribute('href')).toBe(
      'https://www.datos.gov.co/d/mxk5-ce6w',
    );
  });

  it('sin logo muestra iniciales que se entienden', async () => {
    const { html } = await abrir();
    // "BBVA Colombia" no tiene logo en los datos de prueba: "BC", no "B".
    expect(
      html.querySelectorAll('.opcion')[1].querySelector('.iniciales')
        ?.textContent,
    ).toBe('BC');
  });
});
