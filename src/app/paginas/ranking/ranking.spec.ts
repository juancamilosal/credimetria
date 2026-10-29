import { TASAS_DE_PRUEBA } from '../../core/datos/tasas-prueba';
import { CORTE_PRUEBA, TASAS_PRUEBA } from '../../core/datos/tasas-prueba';
import { cuotaMensual } from '../../core/utilidades/credito';
import { formatoPesos } from '../../compartido/pipes/formato';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import {
  TASAS_INICIALES,
  TasasService,
} from '../../core/servicios/tasas.service';
import { Ranking } from './ranking';

/** Tasa real de AV Villas en libre inversión, la primera del ranking. */
const TASAS_PRUEBA_AV_VILLAS = () =>
  TASAS_PRUEBA.filter((t) => t.producto === 'libre-inversion').sort(
    (a, b) => a.tasaReal - b.tasaReal,
  )[0].tasaReal;

describe('Ranking', () => {
  let fixture: ComponentFixture<Ranking>;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Ranking],
      providers: [provideRouter([]), provideLocationMocks(), TASAS_DE_PRUEBA],
    });
    fixture = TestBed.createComponent(Ranking);
    fixture.detectChanges();
    html = fixture.nativeElement;
  });

  /** Nombres de las entidades en el orden en que se ven en la tabla. */
  function entidades(): string[] {
    return [...html.querySelectorAll('tbody tr td:nth-child(2) b')].map((b) =>
      b.textContent!.trim(),
    );
  }

  function titulo(texto: string): HTMLButtonElement {
    return [...html.querySelectorAll<HTMLButtonElement>('th .orden')].find(
      (b) => b.textContent!.includes(texto),
    )!;
  }

  function tocar(boton: HTMLElement) {
    boton.click();
    fixture.detectChanges();
  }

  it('muestra libre inversión ordenada por tasa real, AV Villas primero', () => {
    expect(html.querySelector('caption')?.textContent).toContain(
      'Libre inversión · 7 entidades',
    );
    expect(entidades()[0]).toBe('AV Villas');
    expect(
      titulo('Cobra en promedio').closest('th')!.getAttribute('aria-sort'),
    ).toBe('ascending');
  });

  it('ordena desde el título y cambia de sentido al tocarlo otra vez', () => {
    tocar(titulo('Cobra en promedio'));
    expect(entidades()[0]).toBe('Banco de Bogotá');
    expect(
      titulo('Cobra en promedio').closest('th')!.getAttribute('aria-sort'),
    ).toBe('descending');

    tocar(titulo('Entidad'));
    expect(entidades()[0]).toBe('AV Villas');
    expect(entidades()[1]).toBe('Banco de Bogotá');
    // El # sigue siendo el puesto por tasa real.
    expect(
      html.querySelector('tbody tr .pos .numero')?.textContent?.trim(),
    ).toBe('1');
    expect(
      html.querySelectorAll('tbody tr .pos .numero')[1].textContent?.trim(),
    ).toBe('7');
  });

  it('guarda el orden en la dirección sin navegar (la pantalla no sube)', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl');
    tocar(titulo('Diferencia'));
    fixture.detectChanges();
    expect(TestBed.inject(Location).path()).toContain('orden=diferencia-asc');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('deja al final las entidades sin tasa anunciada', () => {
    tocar(titulo('Anuncia'));
    expect(entidades().at(-1)).toBe('Banco de Bogotá');
    tocar(titulo('Anuncia'));
    expect(entidades().at(-1)).toBe('Banco de Bogotá');
  });

  it('filtra por tipo desde el título "Tipo"', () => {
    tocar(html.querySelector<HTMLButtonElement>('.filtro')!);
    const opcion = [
      ...html.querySelectorAll<HTMLButtonElement>('.menu button'),
    ].find((b) => b.textContent!.includes('Cooperativa'))!;
    tocar(opcion);
    expect(entidades()).toEqual(['Confiar']);
    expect(html.querySelector('.menu')).toBeNull();
    expect(html.querySelector('.filtro')?.textContent).toContain('Cooperativa');
    expect(html.querySelector('caption')?.textContent).toContain(
      'Libre inversión · Cooperativa · 1 entidad',
    );
  });

  it('calcula la cuota de todas con el monto y el plazo escritos', () => {
    const cuotaAvVillas = () =>
      html.querySelector('tbody tr td:nth-child(7)')!.textContent!.trim();
    expect(cuotaAvVillas()).toBe('$604.529');

    const monto = html.querySelector<HTMLInputElement>('#rkMonto')!;
    monto.value = '10.000.000';
    monto.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cuotaAvVillas()).toBe('$302.264');

    const plazo = html.querySelector<HTMLSelectElement>('#rkPlazo')!;
    plazo.value = '36';
    plazo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(cuotaAvVillas()).toBe('$369.685');
    expect(html.querySelector('.ayuda')?.textContent).toContain(
      'Cuota estimada con $10.000.000 a 36 meses',
    );
  });

  it('muestra el pago total y los intereses, y enlaza la fuente del promedio', () => {
    const celda = html.querySelector('tbody tr td:nth-child(8)')!;
    const cuota = cuotaMensual(20_000_000, TASAS_PRUEBA_AV_VILLAS(), 48);
    expect(celda.textContent).toContain(formatoPesos(Math.round(cuota) * 48));
    expect(celda.textContent).toContain(
      'intereses ' + formatoPesos(Math.round(cuota) * 48 - 20_000_000),
    );
    const enlace = html.querySelector<HTMLAnchorElement>('.ayuda a')!;
    expect(enlace.href).toContain('datos.gov.co');
    expect(enlace.target).toBe('_blank');
  });

  it('explica la diferencia con un globo de ayuda en el título', () => {
    const globo = html.querySelector('thead #tipDiferencia')!;
    expect(globo.getAttribute('role')).toBe('tooltip');
    expect(globo.textContent).toContain('anuncia desde 16 %');
    expect(html.querySelector('.tarjetas .dif')?.textContent).toMatch(
      /(más|menos) de lo que\s+anuncia/,
    );
  });

  it('"Quiero esta" lleva el monto a la asesoría', () => {
    const monto = html.querySelector<HTMLInputElement>('#rkMonto')!;
    monto.value = '15.000.000';
    monto.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const enlace = html.querySelector<HTMLAnchorElement>('tbody .quiero')!;
    expect(enlace.getAttribute('href')).toContain('monto=15000000');
  });

  it('muestra el esqueleto mientras llegan las tasas', () => {
    TestBed.inject(TasasService).cargando.set(true);
    fixture.detectChanges();
    expect(html.querySelectorAll('tbody tr.cargando').length).toBe(5);
    expect(entidades()).toEqual([]);
    expect(html.querySelector('caption')!.textContent).toContain('cargando');
    expect(html.textContent).not.toContain('Todavía no tenemos tasas');
  });

  it('marca la primera fila con la pestaña "Mejor tasa"', () => {
    const primera = html.querySelector('tbody tr')!;
    expect(primera.classList).toContain('primera');
    expect(primera.querySelector('.destacado')?.textContent).toContain(
      'Mejor tasa',
    );
    expect(html.querySelectorAll('tbody .destacado').length).toBe(1);
  });

  it('al banco sin tasa publicada le dice "No publica su tasa"', () => {
    const fila = [...html.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent!.includes('Banco de Bogotá'),
    )!;
    expect(fila.querySelector('.no-publica')?.textContent).toContain(
      'No publica su tasa',
    );
  });

  it('en vivienda, sin tasa cargada todavía dice "Por cargar"', () => {
    (
      fixture.componentInstance as unknown as {
        producto: { set(p: string): void };
      }
    ).producto.set('leasing-no-vis');
    fixture.detectChanges();
    expect(html.querySelector('caption')?.textContent).toContain(
      'Leasing habitacional No VIS · 3 entidades',
    );
    expect(entidades()).toEqual([
      'Banco de Occidente',
      'Davivienda',
      'Bancolombia',
    ]);
    expect(html.querySelector('tbody .no-publica')?.textContent).toContain(
      'Por cargar',
    );
    expect(html.textContent).not.toContain('No publica su tasa');
  });

  it('en vivienda, la entidad que no reporta a la Superfinanciera dice "Sin reporte" y va al final', () => {
    (
      fixture.componentInstance as unknown as {
        producto: { set(p: string): void };
      }
    ).producto.set('leasing-no-vis');
    fixture.detectChanges();
    const filas = [...html.querySelectorAll('tbody tr')];
    const ultima = filas.at(-1)!;
    expect(ultima.textContent).toContain('Bancolombia');
    expect(ultima.textContent).toContain('13,50');
    expect(ultima.querySelector('.real')?.textContent).toContain('Sin reporte');
    expect(ultima.classList).not.toContain('primera');
    expect(TestBed.inject(TasasService).mejor('leasing-no-vis')?.entidad).toBe(
      'Banco de Occidente',
    );
  });

  it('en vivienda la cuota se calcula con $150.000.000 a 20 años', () => {
    const select = html.querySelector<HTMLSelectElement>('select')!;
    select.value = 'vivienda';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(html.textContent).toContain('$150.000.000 a 20 años');
  });

  it('consumo ofrece plazos hasta 72 meses y vivienda de 5 a 20 años', () => {
    const opciones = () =>
      [...html.querySelectorAll<HTMLOptionElement>('#rkPlazo option')].map(
        (o) => o.textContent!.trim(),
      );
    expect(opciones()).toEqual([
      '12 meses',
      '24 meses',
      '36 meses',
      '48 meses',
      '60 meses',
      '72 meses',
    ]);
    const select = html.querySelector<HTMLSelectElement>('select')!;
    select.value = 'vivienda';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(opciones()).toEqual(['5 años', '10 años', '15 años', '20 años']);
  });

  it('vivienda se filtra por crédito hipotecario o leasing, y VIS o No VIS', () => {
    const select = html.querySelector<HTMLSelectElement>('select')!;
    const opciones = [...select.options].map((o) => o.textContent!.trim());
    expect(opciones).toContain('Vivienda');
    expect(opciones.join()).not.toContain('Leasing');
    expect(html.querySelector('.segmento')).toBeNull();
    select.value = 'vivienda';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(html.querySelector('caption')?.textContent).toContain(
      'Crédito hipotecario VIS · 2 entidades',
    );
    const boton = (texto: string) =>
      [...html.querySelectorAll<HTMLButtonElement>('.segmento button')].find(
        (b) => b.textContent!.trim() === texto,
      )!;
    expect(boton('VIS').getAttribute('aria-pressed')).toBe('true');
    tocar(boton('No VIS'));
    expect(html.querySelector('caption')?.textContent).toContain(
      'Crédito hipotecario No VIS · 5 entidades',
    );
    // Leasing conserva No VIS.
    tocar(boton('Leasing habitacional'));
    expect(html.querySelector('caption')?.textContent).toContain(
      'Leasing habitacional No VIS · 3 entidades',
    );
    tocar(boton('VIS'));
    expect(html.querySelector('caption')?.textContent).toContain(
      'Leasing habitacional VIS · 1 entidad',
    );
  });

  it('no destaca como "Mejor tasa" a un banco que no publica su tasa', () => {
    TestBed.resetTestingModule();
    const [a, b] = TASAS_PRUEBA.filter((t) => t.producto === 'libranza');
    TestBed.configureTestingModule({
      imports: [Ranking],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: TASAS_INICIALES,
          useValue: {
            corte: CORTE_PRUEBA,
            tasas: [
              {
                ...a,
                entidad: 'Solo promedio',
                tasaReal: 10,
                tasaAnunciada: null,
              },
              { ...b, entidad: 'Publica', tasaReal: 12, tasaAnunciada: 11 },
            ],
          },
        },
      ],
    });
    const f = TestBed.createComponent(Ranking);
    TestBed.inject(Router);
    f.detectChanges();
    const h: HTMLElement = f.nativeElement;
    const select = h.querySelector<HTMLSelectElement>('#rkProducto')!;
    select.value = 'libranza';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(h.querySelector('tbody tr .numero')?.textContent?.trim()).toBe('1');
    expect(h.querySelectorAll('tbody .destacado').length).toBe(0);
  });

  it('al banco que solo publica la máxima le dice "hasta … solo publica la máxima"', () => {
    TestBed.resetTestingModule();
    const [a] = TASAS_PRUEBA.filter((t) => t.producto === 'libranza');
    TestBed.configureTestingModule({
      imports: [Ranking],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: TASAS_INICIALES,
          useValue: {
            corte: CORTE_PRUEBA,
            tasas: [
              {
                ...a,
                entidad: 'GNB Sudameris',
                tasaReal: 19.12,
                tasaAnunciada: null,
                tasaHasta: 24.6,
              },
            ],
          },
        },
      ],
    });
    const f = TestBed.createComponent(Ranking);
    f.detectChanges();
    const h: HTMLElement = f.nativeElement;
    const select = h.querySelector<HTMLSelectElement>('#rkProducto')!;
    select.value = 'libranza';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    const celda = h.querySelectorAll('tbody tr td')[3];
    expect(celda.textContent).toContain('hasta 24,60 %');
    expect(celda.textContent).toContain('solo publica la máxima');
    expect(celda.textContent).not.toContain('No publica su tasa');
  });
});
