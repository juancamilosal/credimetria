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

  /** Toca el botón con ese texto (chips o montos rápidos). */
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

  function enviar() {
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
  }

  it('ya no pregunta ingresos, rango de ingreso ni reportes', () => {
    crear();
    expect(html.textContent).not.toContain('¿De dónde vienen tus ingresos?');
    expect(html.textContent).not.toContain('reportes negativos');
    expect(html.querySelectorAll('fieldset').length).toBe(3);
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
    expect(html.querySelector('#errNombre')).not.toBeNull();
    expect(html.querySelector('#errCel')).not.toBeNull();
    expect(html.querySelector('#errMonto')).toBeNull();
    expect(html.querySelector('.listo')).toBeNull();
  });

  it('un monto que no está en los botones llega en "Otro monto"', () => {
    crear({ producto: 'libranza', monto: '15000000', origen: 'oferta' });
    expect(html.querySelector<HTMLInputElement>('#asMonto')!.value).toBe(
      '15.000.000',
    );
  });

  it('"Otro monto" abre el campo y valida el mínimo', () => {
    crear();
    expect(html.querySelector('#asMonto')).toBeNull();
    tocar('Otro monto');
    escribir('#asMonto', '500.000');
    autorizar();
    enviar();
    expect(html.querySelector('#errMonto')).not.toBeNull();
  });

  it('"Otra" deja escribir la ciudad', () => {
    crear();
    tocar('Otra');
    expect(html.querySelector('#asCiudad')).not.toBeNull();
    autorizar();
    enviar();
    expect(html.querySelector('#errCiudad')?.textContent).toContain(
      'Escribe tu ciudad.',
    );
  });

  it('llega lleno desde el simulador', () => {
    crear({ producto: 'libranza', monto: '20000000', origen: 'simulador' });
    expect(
      html.querySelector('.rapido[aria-pressed=true]')?.textContent,
    ).toContain('$20.000.000');
    expect(
      html.querySelector('app-chips button[aria-pressed=true]')?.textContent,
    ).toContain('Libranza');
    expect(html.textContent).toContain(
      'Desde el simulador: Libranza, $20.000.000.',
    );
  });

  it('con lo mínimo envía y guarda la prueba de la autorización', async () => {
    crear({ urgencia: 'mes' });
    const enviarProspecto = spyOn(
      TestBed.inject(ProspectosService),
      'enviar',
    ).and.callThrough();
    tocar('Libre inversión');
    tocar('Medellín');
    escribir('#asNombre', 'Ana');
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
    expect(prospecto.celular).toBe('3001234567');
    expect(prospecto.autorizacion.texto).toContain('Autorizo a Credimetría');
  });

  it('sin urgencia en el enlace dice "pronto"', async () => {
    crear();
    tocar('Libranza');
    tocar('$10.000.000');
    tocar('Cali');
    escribir('#asNombre', 'Luis');
    escribir('#asCel', '3109876543');
    autorizar();
    enviar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      'te contactará pronto',
    );
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
