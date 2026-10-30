import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { ProspectosService } from '../../core/servicios/prospectos.service';
import { Asesoria } from './asesoria';

describe('Asesoria', () => {
  let fixture: ComponentFixture<Asesoria>;
  let html: HTMLElement;

  function crear(params: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [Asesoria],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
      ],
    });
    fixture = TestBed.createComponent(Asesoria);
    fixture.detectChanges();
    html = fixture.nativeElement;
  }

  function escribir(id: string, valor: string) {
    const input = html.querySelector<HTMLInputElement>(id)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Elige la tarjeta del tipo de crédito con ese nombre. */
  function elegirTipo(nombre: string) {
    const tarjeta = [...html.querySelectorAll<HTMLLabelElement>('.tipo')].find(
      (t) => t.querySelector('.tipo-nombre')?.textContent?.trim() === nombre,
    );
    if (!tarjeta) throw new Error(`No hay tarjeta "${nombre}"`);
    tarjeta.querySelector('input')!.click();
    fixture.detectChanges();
  }

  /** Toca el botón con ese texto. */
  function tocar(texto: string) {
    // Los botones de vivienda traen un texto largo y uno corto (celular).
    const boton = [...html.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => (b.querySelector('.largo') ?? b).textContent?.trim() === texto,
    );
    if (!boton) throw new Error(`No hay botón "${texto}"`);
    boton.click();
    fixture.detectChanges();
  }

  function autorizar() {
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
  }

  function enviar() {
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
  }

  it('ya no pregunta ingresos, rango de ingreso ni reportes', () => {
    crear();
    expect(html.textContent).not.toContain('¿De dónde vienen tus ingresos?');
    expect(html.textContent).not.toContain('reportes negativos');
    // Solo el tipo de crédito y los canales de contacto (la ciudad es un campo).
    expect(html.querySelectorAll('fieldset').length).toBe(2);
  });

  it('el botón queda bloqueado hasta marcar la autorización', () => {
    crear();
    const boton = html.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(boton.disabled).toBeTrue();
    expect(boton.textContent).toContain('Marca la autorización');
    autorizar();
    expect(boton.disabled).toBeFalse();
    expect(boton.textContent).toContain('Quiero que me asesoren');
  });

  it('pide crédito, ciudad, nombre y celular, pero no el monto', () => {
    crear();
    autorizar();
    enviar();
    expect(html.querySelector('#errProducto')).not.toBeNull();
    expect(html.querySelector('#errCiudad')).not.toBeNull();
    expect(html.querySelector('#errNombres')).not.toBeNull();
    expect(html.querySelector('#errApellidos')).not.toBeNull();
    expect(html.querySelector('#errCel')).not.toBeNull();
    expect(html.querySelector('#errMonto')).toBeNull();
    expect(html.querySelector('.listo')).toBeNull();
  });

  it('el monto que llega en el enlace queda escrito', () => {
    crear({ producto: 'libranza', monto: '15000000', origen: 'oferta' });
    expect(html.querySelector<HTMLInputElement>('#asMonto')!.value).toBe(
      '15.000.000',
    );
  });

  it('el monto es un solo campo con "$" y valida el mínimo', () => {
    crear();
    expect(html.querySelector('.con-prefijo span')?.textContent).toBe('$');
    escribir('#asMonto', '500.000');
    autorizar();
    enviar();
    expect(html.querySelector('#errMonto')).not.toBeNull();
  });

  it('la ciudad es un solo campo con sugerencias', () => {
    crear();
    const ciudad = html.querySelector<HTMLInputElement>('#asCiudad')!;
    expect(ciudad.getAttribute('list')).toBe('asCiudades');
    expect(html.querySelectorAll('#asCiudades option').length).toBeGreaterThan(
      10,
    );
    autorizar();
    enviar();
    expect(html.querySelector('#errCiudad')?.textContent).toContain(
      'Escribe tu ciudad.',
    );
  });

  it('el tipo de crédito son cuatro tarjetas con ícono', () => {
    crear();
    const nombres = [...html.querySelectorAll('.tipo .tipo-nombre')].map((n) =>
      n.textContent!.trim(),
    );
    expect(nombres).toEqual([
      'Libranza',
      'Libre inversión',
      'Vehículo',
      'Vivienda',
    ]);
    expect(html.querySelectorAll('.tipo svg').length).toBeGreaterThanOrEqual(4);
    elegirTipo('Vehículo');
    expect(html.querySelector('.tipo.elegido .tipo-nombre')?.textContent).toBe(
      'Vehículo',
    );
  });

  it('en vivienda se elige hipotecario o leasing, y VIS o No VIS', async () => {
    crear();
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.callThrough();
    elegirTipo('Vivienda');
    tocar('Leasing habitacional');
    tocar('No VIS');
    escribir('#asCiudad', 'Pereira');
    escribir('#asNombres', 'Ana');
    escribir('#asApellidos', 'Gómez');
    escribir('#asCel', '3001234567');
    autorizar();
    enviar();
    await fixture.whenStable();
    expect(enviarProspecto.calls.mostRecent().args[0].producto).toBe(
      'leasing-no-vis',
    );
  });

  it('llega lleno desde el simulador', () => {
    crear({ producto: 'libranza', monto: '20000000', origen: 'simulador' });
    expect(html.querySelector<HTMLInputElement>('#asMonto')!.value).toBe(
      '20.000.000',
    );
    expect(html.querySelector('.tipo.elegido .tipo-nombre')?.textContent).toBe(
      'Libranza',
    );
    expect(html.textContent).toContain(
      'Desde el simulador: Libranza, $20.000.000.',
    );
  });

  it('desde el ranking de vivienda llega con la tarjeta y los filtros', () => {
    crear({ producto: 'vivienda-no-vis' });
    expect(html.querySelector('.tipo.elegido .tipo-nombre')?.textContent).toBe(
      'Vivienda',
    );
    const activos = [...html.querySelectorAll('.segmento button.activo')].map(
      (b) => (b.querySelector('.largo') ?? b).textContent!.trim(),
    );
    expect(activos).toEqual(['Crédito hipotecario', 'No VIS']);
  });

  it('con lo mínimo envía y guarda la prueba de la autorización', async () => {
    crear({ urgencia: 'mes' });
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.callThrough();
    elegirTipo('Libre inversión');
    escribir('#asCiudad', 'Medellín');
    escribir('#asNombres', 'Ana María');
    escribir('#asApellidos', 'Gómez Rojas');
    escribir('#asCel', '300 123 4567');
    autorizar();
    enviar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      '¡Listo! Un asesor te contactará en los próximos días',
    );
    const prospecto = enviarProspecto.calls.mostRecent().args[0];
    expect(prospecto.producto).toBe('libre-inversion');
    expect(prospecto.ciudad).toBe('Medellín');
    expect(prospecto.monto).toBeNull();
    expect(prospecto.nombres).toBe('Ana María');
    expect(prospecto.apellidos).toBe('Gómez Rojas');
    expect(prospecto.celular).toBe('3001234567');
    expect(prospecto.autorizacion.texto).toContain('Autorizo a Credimetría');
  });

  it('sin urgencia en el enlace dice "pronto"', async () => {
    crear();
    elegirTipo('Libranza');
    escribir('#asMonto', '10.000.000');
    escribir('#asCiudad', 'Cali');
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    autorizar();
    enviar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      'te contactará pronto',
    );
  });

  it('muestra el bloque "Tus datos de contacto"', () => {
    crear();
    const bloque = html.querySelector('.contacto')!;
    expect(bloque.querySelector('h2')?.textContent).toContain(
      'Tus datos de contacto',
    );
    expect(bloque.querySelector('#asNombres')).not.toBeNull();
    expect(bloque.querySelector('#asApellidos')).not.toBeNull();
    expect(bloque.querySelector('#asCel')).not.toBeNull();
  });

  it('pide el correo si marca Correo', () => {
    crear();
    const casillas = html.querySelectorAll<HTMLInputElement>(
      '[formGroupName=canales] input',
    );
    casillas[2].click();
    fixture.detectChanges();
    expect(html.querySelector('#asCorreo')).not.toBeNull();
  });
});
