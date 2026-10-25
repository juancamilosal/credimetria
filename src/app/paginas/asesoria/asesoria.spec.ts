import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Asesoria } from './asesoria';

describe('Asesoria', () => {
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
    const fixture = TestBed.createComponent(Asesoria);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function escribir(html: HTMLElement, id: string, valor: string) {
    const input = html.querySelector<HTMLInputElement>(id)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function marcarAutorizacion(html: HTMLElement) {
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
  }

  it('el botón queda bloqueado hasta marcar la autorización', () => {
    const { fixture, html } = crear();
    const boton = html.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(boton.disabled).toBeTrue();
    expect(boton.textContent).toContain('Marca la autorización');

    marcarAutorizacion(html);
    fixture.detectChanges();
    expect(boton.disabled).toBeFalse();
    expect(boton.textContent).toContain('Quiero que me asesoren');
  });

  it('muestra los errores al intentar enviar vacío', () => {
    const { fixture, html } = crear();
    marcarAutorizacion(html);
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    expect(html.querySelector('#errMonto')).not.toBeNull();
    expect(html.querySelector('#errCiudad')).not.toBeNull();
    expect(html.querySelector('#errNombre')).not.toBeNull();
    expect(html.querySelector('#errCel')).not.toBeNull();
    expect(html.querySelector('.listo')).toBeNull();
  });

  it('llega lleno desde el simulador', () => {
    const { html } = crear({
      producto: 'libranza',
      monto: '20000000',
      origen: 'simulador',
    });
    expect(html.querySelector<HTMLInputElement>('#asMonto')!.value).toBe(
      '20.000.000',
    );
    expect(
      html.querySelector('app-chips button[aria-pressed=true]')?.textContent,
    ).toContain('Libranza');
    expect(html.textContent).toContain(
      'Desde el simulador: Libranza, $20.000.000.',
    );
  });

  it('con todo bien muestra "¡Listo!" según la urgencia', async () => {
    const { fixture, html } = crear({ urgencia: 'mes' });
    escribir(html, '#asMonto', '30.000.000');
    escribir(html, '#asCiudad', 'Bogotá');
    escribir(html, '#asNombre', 'Ana');
    escribir(html, '#asCel', '300 123 4567');
    marcarAutorizacion(html);
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      '¡Listo! Un asesor te contactará en los próximos días',
    );
  });

  it('pide el correo si marca Correo', () => {
    const { fixture, html } = crear();
    const casillas = html.querySelectorAll<HTMLInputElement>(
      '[formGroupName=canales] input',
    );
    casillas[2].click();
    fixture.detectChanges();
    expect(html.querySelector('#asCorreo')).not.toBeNull();
  });
});
