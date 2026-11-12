import { TASAS_DE_PRUEBA } from '../../core/datos/tasas-prueba';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { SimuladorPagina } from './simulador-pagina';

describe('SimuladorPagina', () => {
  async function abrir(url: string) {
    registerLocaleData(localeEsCo);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        TASAS_DE_PRUEBA,
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, SimuladorPagina);
    harness.detectChanges();
    return harness;
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return [...html.querySelectorAll<HTMLButtonElement>('.modo')].find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  it('sin modo abre la calculadora', async () => {
    const html = (await abrir('/simulador')).routeNativeElement!;
    expect(html.querySelector('app-simulador')).not.toBeNull();
    expect(html.querySelector('app-compara-oferta')).toBeNull();
    expect(
      boton(html, 'Quiero calcular un crédito').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('con ?modo=oferta abre el chat de la oferta, sin su introducción', async () => {
    const html = (await abrir('/simulador?modo=oferta')).routeNativeElement!;
    expect(html.querySelector('app-compara-oferta')).not.toBeNull();
    expect(html.querySelector('app-simulador')).toBeNull();
    expect(html.querySelector('app-compara-oferta .intro')).toBeNull();
    expect(html.querySelector('app-compara-oferta .chat')).not.toBeNull();
  });

  it('los botones cambian de camino y lo dejan en la dirección', async () => {
    const harness = await abrir('/simulador');
    const html = harness.routeNativeElement!;
    boton(html, 'Me ofrecieron un crédito').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(html.querySelector('app-compara-oferta')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/simulador?modo=oferta');

    boton(html, 'Quiero calcular un crédito').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(html.querySelector('app-simulador')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/simulador');
  });

  it('/compara-tu-oferta lleva al simulador en modo oferta', async () => {
    const harness = await abrir('/compara-tu-oferta');
    expect(TestBed.inject(Router).url).toBe('/simulador?modo=oferta');
    expect(
      harness.routeNativeElement!.querySelector('app-compara-oferta'),
    ).not.toBeNull();
  });
});
