import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { entidadDePrueba } from '../../core/datos/financieros-prueba';
import { DatosFinancieros } from '../../core/modelos/financiero';
import { FINANCIEROS_INICIALES } from '../../core/servicios/financieros.service';
import { GananciasBancos } from './ganancias-bancos';

const MM = 1e9;

function datos(): DatosFinancieros {
  const banco = (codigo: string, nombre: string, utilidad: number) => {
    const e = entidadDePrueba({ utilidad });
    e.codigo = codigo;
    e.nombre = nombre;
    return e;
  };
  const financiera = banco('koa', 'Koa', 3000 * MM);
  financiera.tipo = 'Financiera';
  const bogota = banco('bogota', 'Banco de Bogotá', 820 * MM);
  bogota.actual.variacionUtilidad = -0.006;
  bogota.logo = '/api/logos/bogota';
  return {
    fuente: 'CUIF',
    consulta: 'https://www.datos.gov.co/d/mxk5-ce6w',
    corte: '2026-08-31',
    entidades: [
      financiera,
      banco('bancolombia', 'Bancolombia', 5331 * MM),
      banco('davivienda', 'Davivienda', 1629 * MM),
      bogota,
      banco('bbva', 'BBVA', 663 * MM),
    ],
  };
}

describe('GananciasBancos', () => {
  function crear(valor: DatosFinancieros | null) {
    TestBed.configureTestingModule({
      imports: [GananciasBancos],
      providers: [
        provideRouter([]),
        ...(valor ? [{ provide: FINANCIEROS_INICIALES, useValue: valor }] : []),
      ],
    });
    const fixture = TestBed.createComponent(GananciasBancos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los 3 bancos que más ganan (sin financieras) con enlace a cada uno', () => {
    const html = crear(datos());
    expect(html.querySelector('h2')?.textContent).toContain(
      '¿Cuánto ganan los bancos?',
    );
    expect(html.querySelector('.sub')?.textContent).toContain(
      'enero a agosto de 2026',
    );
    const tarjetas = [...html.querySelectorAll<HTMLAnchorElement>('a.banco')];
    expect(tarjetas.length).toBe(3);
    expect(tarjetas[0].textContent).toContain('Bancolombia');
    expect(tarjetas[0].textContent).toContain('$5,33 billones');
    expect(tarjetas[0].getAttribute('href')).toBe(
      '/estados-financieros?entidad=bancolombia',
    );
    // El nombre va siempre, aunque haya logo (si el logo no carga, se lee).
    expect(tarjetas[2].querySelector('img.logo')).toBeTruthy();
    expect(tarjetas[2].querySelector('.nombre')?.textContent).toBe(
      'Banco de Bogotá',
    );
    expect(tarjetas[2].querySelector('.cambio.baja')?.textContent).toContain(
      '−1 %',
    );
    expect(html.textContent).not.toContain('Koa');
    expect(html.querySelector('.titulo-sec a')?.getAttribute('href')).toBe(
      '/estados-financieros',
    );
  });

  it('sin cifras la sección no aparece', () => {
    const html = crear(null);
    expect(html.querySelector('section')).toBeNull();
  });
});
