import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PAGINAS_TASAS } from '../../core/datos/paginas-tasas';
import { TASAS_DE_PRUEBA, TASAS_PRUEBA } from '../../core/datos/tasas-prueba';
import { routes } from '../../app.routes';
import { fechaCorta } from './tasas-producto';

describe('TasasProducto', () => {
  async function abrir(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), TASAS_DE_PRUEBA],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('cada tipo de crédito tiene su ruta /tasas/<slug>', () => {
    for (const p of PAGINAS_TASAS) {
      expect(routes.some((r) => r.path === `tasas/${p.slug}`))
        .withContext(p.slug)
        .toBeTrue();
    }
  });

  it('muestra el título, el resumen y la tabla del producto', async () => {
    const harness = await abrir('/tasas/credito-de-vehiculo');
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('h1')?.textContent).toContain(
      'Tasas de crédito de vehículo en Colombia',
    );
    const vehiculo = TASAS_PRUEBA.filter(
      (t) => t.producto === 'vehiculo' && !t.sinReporte,
    ).sort((a, b) => a.tasaReal - b.tasaReal);
    const resumen = el.querySelector('.resumen')!.textContent!;
    expect(resumen).toContain(vehiculo[0].entidad);
    expect(resumen).toContain(`Promedio de ${vehiculo.length} entidades`);
    // Vehículo es crédito de consumo: muestra la usura.
    expect(resumen).toContain('Máximo legal (usura)');
    expect(el.querySelector('app-tabla-ranking')).not.toBeNull();
  });

  it('pone las preguntas frecuentes como JSON-LD para Google', async () => {
    await abrir('/tasas/credito-hipotecario-vis');
    const script = TestBed.inject(DOCUMENT).getElementById('ld-preguntas');
    const datos = JSON.parse(script!.textContent!);
    expect(datos['@type']).toBe('FAQPage');
    const preguntas: string[] = datos.mainEntity.map(
      (q: { name: string }) => q.name,
    );
    expect(preguntas).toContain(
      '¿Qué entidad cobra menos por el crédito hipotecario VIS?',
    );
    expect(preguntas).toContain('¿Qué es una vivienda VIS?');
    // Vivienda no es consumo: sin pregunta de usura.
    expect(preguntas).not.toContain(
      '¿Cuál es la tasa máxima que me pueden cobrar?',
    );
  });

  it('enlaza las páginas de los otros créditos', async () => {
    const harness = await abrir('/tasas/credito-de-libranza');
    const enlaces = [
      ...harness.routeNativeElement!.querySelectorAll('.otras a'),
    ].map((a) => a.getAttribute('href'));
    expect(enlaces.length).toBe(PAGINAS_TASAS.length - 1);
    expect(enlaces).toContain('/tasas/credito-de-vehiculo');
    expect(enlaces).not.toContain('/tasas/credito-de-libranza');
  });

  it('escribe la fecha del corte corta', () => {
    expect(fechaCorta('2026-11-06')).toBe('6 nov 2026');
    expect(fechaCorta(null)).toBe('');
  });
});
