import { TASAS_DE_PRUEBA } from '../../core/datos/tasas-prueba';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AnaliticaService } from '../../core/servicios/analitica.service';
import { TasasService } from '../../core/servicios/tasas.service';
import { Inicio } from './inicio';

describe('Inicio', () => {
  function crear() {
    registerLocaleData(localeEsCo);
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'es-CO' },
        TASAS_DE_PRUEBA,
      ],
    });
    fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  let fixture: ComponentFixture<Inicio>;

  /** Entidades de las tarjetas, en orden. */
  function tarjetas(html: HTMLElement): string[] {
    return [...html.querySelectorAll('.banco h3')].map((h) =>
      h.textContent!.trim(),
    );
  }

  function titulo(html: HTMLElement): string {
    return html
      .querySelector('#tituloTop')!
      .textContent!.replace(/\s+/g, ' ')
      .trim();
  }

  it('dice qué hace Credimetría', () => {
    expect(crear().querySelector('h1')?.textContent).toContain(
      'Compara con datos, no con promesas',
    );
  });

  it('muestra los 3 bancos que menos cobran en libre inversión', () => {
    const html = crear();
    const nombres = [...html.querySelectorAll('.banco h3')].map((h) =>
      h.textContent?.trim(),
    );
    const esperados = TestBed.inject(TasasService)
      .ranking('libre-inversion')
      .slice(0, 3)
      .map((t) => t.entidad);
    expect(nombres).toEqual(esperados);
    expect(html.querySelector('.primero .destacado')?.textContent).toContain(
      'Mejor tasa',
    );
    // Tarjeta corta: lo que cobra, la cuota de ejemplo, el ahorro y "Quiero esta".
    const primera = html.querySelector('.primero')!;
    expect(primera.querySelector('.cobra')?.textContent).toContain(
      'Cuota de $',
    );
    expect(primera.querySelector('.ahorro')?.textContent).toContain(
      'menos que con el #2',
    );
    expect(primera.querySelector('.total')).toBeNull();
    expect(primera.querySelector('.detalle')).toBeNull();
    expect(primera.querySelectorAll('.banco-pie a').length).toBe(1);
    expect(
      html.querySelector<HTMLAnchorElement>('.top-pie .nota a')?.href,
    ).toContain('datos.gov.co');
    expect(
      primera.querySelector<HTMLAnchorElement>('.quiero')?.getAttribute('href'),
    ).toContain('origen=inicio');
  });

  it('"Quiero esta" envía "clic_quiero_esta" con la entidad', () => {
    const html = crear();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const evento = spyOn(TestBed.inject(AnaliticaService), 'evento');
    html.querySelector<HTMLAnchorElement>('.primero .quiero')!.click();
    expect(evento).toHaveBeenCalledOnceWith('clic_quiero_esta', {
      entidad: tarjetas(html)[0],
      pagina: '/',
      producto: 'libre-inversion',
    });
  });

  it('no muestra la lista de productos: se cambia con las flechas', () => {
    const html = crear();
    expect(html.querySelector('.pestana, [role=tablist]')).toBeNull();
    expect(titulo(html)).toBe('Las 3 tasas más bajas en libre inversión');
    const flecha = (nombre: string) =>
      html.querySelector<HTMLButtonElement>(`[aria-label="${nombre}"]`)!;
    flecha('Producto siguiente').click();
    fixture.detectChanges();
    expect(titulo(html)).toBe('Las 3 tasas más bajas en libranza');
    const esperados = TestBed.inject(TasasService)
      .ranking('libranza')
      .slice(0, 3)
      .map((t) => t.entidad);
    expect(tarjetas(html)).toEqual(esperados);
    expect(
      html
        .querySelector<HTMLAnchorElement>('.top-pie > a')!
        .getAttribute('href'),
    ).toContain('producto=libranza');
    flecha('Producto anterior').click();
    flecha('Producto anterior').click();
    fixture.detectChanges();
    // Desde el primero, "anterior" da la vuelta al último y las tarjetas
    // entran desde la izquierda.
    expect(titulo(html)).not.toBe('Las 3 tasas más bajas en libre inversión');
    expect(html.querySelector('.bancos.desde-izquierda')).not.toBeNull();
    // Sin pausa, barra ni cuenta: solo las dos flechas a los lados.
    expect(html.querySelector('.pausa, .progreso, .cuenta')).toBeNull();
    const carrusel = html.querySelector('.carrusel')!;
    expect(carrusel.firstElementChild!.getAttribute('aria-label')).toBe(
      'Producto anterior',
    );
    expect(carrusel.lastElementChild!.getAttribute('aria-label')).toBe(
      'Producto siguiente',
    );
  });

  it('pasa solo al siguiente producto cada 7 segundos y se detiene con el cursor encima', async () => {
    jasmine.clock().install();
    try {
      const html = crear();
      await fixture.whenStable();
      jasmine.clock().tick(6_999);
      fixture.detectChanges();
      expect(titulo(html)).toBe('Las 3 tasas más bajas en libre inversión');
      jasmine.clock().tick(1);
      fixture.detectChanges();
      expect(titulo(html)).toBe('Las 3 tasas más bajas en libranza');
      // Con el cursor encima no cambia.
      html.querySelector('section.top')!.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      jasmine.clock().tick(30_000);
      fixture.detectChanges();
      expect(titulo(html)).toBe('Las 3 tasas más bajas en libranza');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('no muestra el simulador', () => {
    expect(crear().querySelector('app-simulador')).toBeNull();
  });

  it('debajo del muro de logos dice que Credimetría es independiente', () => {
    const html = crear();
    expect(
      html.querySelector('.entidades + .independiente')?.textContent,
    ).toContain(
      'Las marcas y logos pertenecen a sus dueños. Credimetría es independiente y no tiene relación comercial con estas entidades.',
    );
  });

  it('aclara que "Quiero esta" contacta a un asesor aliado y no a la entidad', () => {
    const html = crear();
    const texto = 'Te contacta un asesor aliado de Credimetría, no la entidad.';
    expect(html.querySelector('.contacta')?.textContent).toContain(texto);
    expect(html.querySelector('.quiero')?.getAttribute('title')).toBe(texto);
  });

  it('tiene la sección para reportados con su foto y el enlace a la página', () => {
    const html = crear();
    const seccion = html.querySelector('.reportados')!;
    expect(seccion.querySelector('h2')?.textContent).toContain(
      '¿Estás reportado? Igual puedes conseguir crédito',
    );
    expect(seccion.querySelector('img')?.getAttribute('src')).toBe(
      '/imagenes/hombre-reportado-facturas-1280.webp',
    );
    expect(seccion.querySelector('a.btn')?.getAttribute('href')).toBe(
      '/creditos-para-reportados',
    );
  });

  it('explica arriba qué es Credimetría y muestra "Así funciona" con enlaces', () => {
    const html = crear();
    expect(html.querySelector('.hero-texto p')?.textContent).toContain(
      'Credimetría compara gratis las tasas de crédito',
    );
    const pasos = html.querySelectorAll('#como-funciona .paso');
    expect(pasos.length).toBe(3);
    const enlaces = [
      ...html.querySelectorAll('#como-funciona .paso-enlace'),
    ].map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/ranking', '/simulador', '/asesoria']);
    // Va justo después de "Las 3 tasas más bajas".
    expect(html.querySelector('.top + #como-funciona')).not.toBeNull();
  });
});
