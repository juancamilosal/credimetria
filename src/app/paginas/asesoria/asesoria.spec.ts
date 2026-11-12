import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { ProspectosService } from '../../core/servicios/prospectos.service';
import {
  EventosTurnstile,
  TurnstileService,
} from '../../core/servicios/turnstile.service';
import { Asesoria } from './asesoria';

describe('Asesoria', () => {
  let fixture: ComponentFixture<Asesoria>;
  let html: HTMLElement;
  /** Turnstile de mentiras: entrega un token al mostrarse y al reiniciarse. */
  let turnstile: {
    eventos: EventosTurnstile | null;
    tokens: number;
    reinicios: number;
    quitados: string[];
    darToken: boolean;
  };
  let falso: Partial<TurnstileService>;

  beforeEach(() => {
    turnstile = {
      eventos: null,
      tokens: 0,
      reinicios: 0,
      quitados: [],
      darToken: true,
    };
    const entregar = () => {
      if (turnstile.darToken)
        turnstile.eventos?.token(`token-${++turnstile.tokens}`);
    };
    falso = {
      mostrar: (_el: HTMLElement, eventos: EventosTurnstile) => {
        turnstile.eventos = eventos;
        entregar();
        return Promise.resolve('widget-1');
      },
      reiniciar: () => {
        turnstile.reinicios++;
        entregar();
      },
      quitar: (id: string) => {
        turnstile.quitados.push(id);
      },
    };
  });

  function crear(params: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [Asesoria],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TurnstileService, useValue: falso },
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
    const boton = [...html.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
    if (!boton) throw new Error(`No hay botón "${texto}"`);
    boton.click();
    fixture.detectChanges();
  }

  function autorizar() {
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
  }

  /** Sale del campo (así se marca como tocado y muestra su error). */
  function salir(id: string) {
    html.querySelector<HTMLElement>(id)!.dispatchEvent(new Event('blur'));
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
    // Con todo a la vista: solo el tipo de crédito y los canales de
    // contacto (la ciudad es un campo).
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    expect(html.querySelectorAll('fieldset').length).toBe(2);
  });

  it('arranca solo con el tipo de crédito y muestra lo demás a medida que llena', () => {
    crear();
    const hay = (sel: string) => html.querySelector(sel) !== null;
    expect(hay('.tipos')).toBeTrue();
    expect(hay('#asMonto') || hay('#asCiudad')).toBeFalse();
    expect(hay('.contacto') || hay('.autoriza')).toBeFalse();
    elegirTipo('Libranza');
    expect(hay('#asMonto') && hay('#asCiudad')).toBeTrue();
    expect(hay('.contacto')).toBeFalse();
    escribir('#asCiudad', 'Cal');
    expect(hay('.contacto')).toBeTrue();
    expect(hay('.autoriza')).toBeFalse();
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    expect(hay('.autoriza')).toBeFalse();
    escribir('#asCorreo', 'luis@ejemplo.com');
    expect(hay('.autoriza')).toBeTrue();
  });

  it('el botón siempre se ve y se habilita solo con todo lleno y la autorización', () => {
    crear();
    const boton = () =>
      html.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(boton().textContent!.trim()).toBe('Quiero que me asesoren');
    expect(boton().disabled).toBeTrue();
    expect(html.querySelector('.falta')?.textContent).toContain(
      'marca la autorización',
    );
    // Tocarlo deshabilitado no muestra nada nuevo ni envía.
    enviar();
    expect(html.querySelector('.contacto')).toBeNull();
    expect(html.querySelector('.listo')).toBeNull();
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    escribir('#asCorreo', 'luis@ejemplo.com');
    expect(boton().disabled).toBeTrue();
    autorizar();
    expect(boton().disabled).toBeFalse();
    expect(html.querySelector('.falta')).toBeNull();
  });

  it('pide ciudad, nombre, celular y correo al salir de cada campo, pero no el monto', () => {
    crear();
    elegirTipo('Libranza');
    salir('#asMonto');
    escribir('#asCiudad', 'Cali');
    escribir('#asCiudad', '');
    salir('#asCiudad');
    for (const id of ['#asNombres', '#asApellidos', '#asCel', '#asCorreo'])
      salir(id);
    expect(html.querySelector('#errCiudad')).not.toBeNull();
    expect(html.querySelector('#errNombres')).not.toBeNull();
    expect(html.querySelector('#errApellidos')).not.toBeNull();
    expect(html.querySelector('#errCel')).not.toBeNull();
    expect(html.querySelector('#errCorreo')).not.toBeNull();
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
    elegirTipo('Libranza');
    expect(html.querySelector('.con-prefijo span')?.textContent).toBe('$');
    escribir('#asMonto', '500.000');
    salir('#asMonto');
    expect(html.querySelector('#errMonto')).not.toBeNull();
  });

  it('la ciudad es un solo campo con sugerencias', () => {
    crear();
    elegirTipo('Libranza');
    const ciudad = html.querySelector<HTMLInputElement>('#asCiudad')!;
    expect(ciudad.getAttribute('list')).toBe('asCiudades');
    expect(html.querySelectorAll('#asCiudades option').length).toBeGreaterThan(
      10,
    );
    salir('#asCiudad');
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

  it('vivienda no pregunta más: el prospecto dice "vivienda"', async () => {
    crear();
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.resolveTo();
    elegirTipo('Vivienda');
    expect(html.querySelector('.segmento')).toBeNull();
    expect(html.textContent).not.toContain('Leasing habitacional');
    escribir('#asCiudad', 'Pereira');
    escribir('#asNombres', 'Ana');
    escribir('#asApellidos', 'Gómez');
    escribir('#asCel', '3001234567');
    escribir('#asCorreo', 'ana@ejemplo.com');
    autorizar();
    enviar();
    await fixture.whenStable();
    expect(enviarProspecto.calls.mostRecent().args[0].producto).toBe(
      'vivienda',
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

  it('desde el ranking de vivienda guarda el producto exacto sin preguntarlo', async () => {
    crear({ producto: 'vivienda-no-vis' });
    expect(html.querySelector('.tipo.elegido .tipo-nombre')?.textContent).toBe(
      'Vivienda',
    );
    expect(html.querySelector('.segmento')).toBeNull();
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.resolveTo();
    escribir('#asCiudad', 'Cali');
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    escribir('#asCorreo', 'luis@ejemplo.com');
    autorizar();
    enviar();
    await fixture.whenStable();
    expect(enviarProspecto.calls.mostRecent().args[0].producto).toBe(
      'vivienda-no-vis',
    );
  });

  it('con lo mínimo envía y guarda la prueba de la autorización', async () => {
    crear({ urgencia: 'mes' });
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.resolveTo();
    elegirTipo('Libre inversión');
    escribir('#asCiudad', 'Medellín');
    escribir('#asNombres', 'Ana María');
    escribir('#asApellidos', 'Gómez Rojas');
    escribir('#asCel', '300 123 4567');
    escribir('#asCorreo', ' ana@ejemplo.com ');
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
    expect(prospecto.nombres).toBe('ANA MARÍA');
    expect(prospecto.apellidos).toBe('GÓMEZ ROJAS');
    expect(prospecto.celular).toBe('3001234567');
    expect(prospecto.correo).toBe('ana@ejemplo.com');
    expect(prospecto.autorizacion.texto).toContain('Autorizo a Credimetría');
    expect(prospecto.autorizacion.texto).toContain('credimetria.com/aliados');
    expect(prospecto.autorizacion.versionPolitica).toBe('2026-11-12');
  });

  it('sin urgencia en el enlace dice "pronto"', async () => {
    crear();
    spyOn(TestBed.inject(ProspectosService), 'enviar').and.resolveTo();
    elegirTipo('Libranza');
    escribir('#asMonto', '10.000.000');
    escribir('#asCiudad', 'Cali');
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    escribir('#asCorreo', 'luis@ejemplo.com');
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
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    const bloque = html.querySelector('.contacto')!;
    expect(bloque.querySelector('h2')?.textContent).toContain(
      'Tus datos de contacto',
    );
    expect(bloque.querySelector('#asNombres')).not.toBeNull();
    expect(bloque.querySelector('#asApellidos')).not.toBeNull();
    expect(bloque.querySelector('#asCel')).not.toBeNull();
  });

  it('el correo siempre está y se pide (allí llega la confirmación)', () => {
    crear();
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    expect(html.querySelector('#asCorreo')).not.toBeNull();
    expect(html.textContent).toContain('Allí te llega la confirmación.');
    escribir('#asCorreo', 'sin-arroba');
    salir('#asCorreo');
    expect(html.querySelector('#errCorreo')?.textContent).toContain(
      'Escribe un correo válido.',
    );
  });

  /** Llena lo mínimo para poder enviar. */
  function llenar() {
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    escribir('#asNombres', 'Luis');
    escribir('#asApellidos', 'Pérez');
    escribir('#asCel', '3109876543');
    escribir('#asCorreo', 'luis@ejemplo.com');
    autorizar();
  }

  it('manda la solicitud a /api/prospectos', async () => {
    crear();
    const http = TestBed.inject(HttpTestingController);
    llenar();
    enviar();
    expect(html.querySelector('button[type=submit]')?.textContent?.trim()).toBe(
      'Enviando…',
    );
    const pedido = http.expectOne('/api/prospectos');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body.correo).toBe('luis@ejemplo.com');
    expect(pedido.request.body.turnstileToken).toBe('token-1');
    pedido.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo')).not.toBeNull();
    expect(html.textContent).not.toContain('Versión de prueba');
  });

  it('si el servidor falla se queda en el formulario y lo dice', async () => {
    crear();
    const http = TestBed.inject(HttpTestingController);
    llenar();
    enviar();
    http
      .expectOne('/api/prospectos')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo')).toBeNull();
    expect(html.querySelector('.fallo')?.textContent).toContain(
      'No pudimos enviar tu solicitud',
    );
    expect(
      html.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled,
    ).toBeFalse();
  });

  it('sin token de Turnstile el botón sigue deshabilitado y lo explica', () => {
    turnstile.darToken = false;
    crear();
    llenar();
    const boton = html.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(boton.disabled).toBeTrue();
    expect(html.querySelector('.falta')?.textContent).toContain(
      'no eres un robot',
    );
    turnstile.eventos!.token('tarde');
    fixture.detectChanges();
    expect(boton.disabled).toBeFalse();
    turnstile.eventos!.vencido();
    fixture.detectChanges();
    expect(boton.disabled).toBeTrue();
  });

  it('si Turnstile falla muestra el mensaje', () => {
    turnstile.darToken = false;
    crear();
    llenar();
    turnstile.eventos!.error();
    fixture.detectChanges();
    expect(html.querySelector('.fallo')?.textContent).toContain(
      'No pudimos comprobar que no eres un robot',
    );
  });

  it('si el servidor rechaza la verificación lo dice y pide otro token', async () => {
    crear();
    const http = TestBed.inject(HttpTestingController);
    llenar();
    enviar();
    http
      .expectOne('/api/prospectos')
      .flush(
        { error: 'verificacion' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(turnstile.reinicios).toBe(1);
    expect(html.querySelector('.fallo')?.textContent).toContain(
      'No pudimos comprobar que no eres un robot',
    );
    // Con el token nuevo puede volver a enviar.
    enviar();
    expect(http.expectOne('/api/prospectos').request.body.turnstileToken).toBe(
      'token-2',
    );
  });

  it('quita el widget al salir de la página', async () => {
    crear();
    await fixture.whenStable();
    fixture.destroy();
    expect(turnstile.quitados).toEqual(['widget-1']);
  });

  it('el celular acepta solo números y máximo 10', () => {
    crear();
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    const cel = html.querySelector<HTMLInputElement>('#asCel')!;
    expect(cel.maxLength).toBe(10);
    escribir('#asCel', '300-123 45678999');
    expect(cel.value).toBe('3001234567');
  });

  it('nombres y apellidos se ven en mayúsculas', () => {
    crear();
    elegirTipo('Libranza');
    escribir('#asCiudad', 'Cali');
    for (const id of ['#asNombres', '#asApellidos']) {
      const input = html.querySelector<HTMLInputElement>(id)!;
      expect(getComputedStyle(input).textTransform).toBe('uppercase');
    }
  });
});
