import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
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

  /** Toca el botón con ese texto (chips, montos rápidos o navegación). */
  function tocar(texto: string) {
    const boton = [...html.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
    if (!boton) throw new Error(`No hay botón "${texto}"`);
    boton.click();
    fixture.detectChanges();
  }

  function titulo(): string {
    return html.querySelector('#tituloPaso')!.textContent!.trim();
  }

  function llenarPaso1() {
    tocar('$20.000.000');
    tocar('Continuar');
  }

  function llenarPaso2() {
    tocar('Empleado');
    tocar('$2 a $4 millones');
    tocar('No');
    tocar('Medellín');
    tocar('Continuar');
  }

  it('arranca en el paso 1 y no sigue sin monto', () => {
    crear();
    expect(titulo()).toContain('Paso 1 de 3');
    tocar('Continuar');
    expect(titulo()).toContain('Paso 1 de 3');
    expect(html.querySelector('#errMonto')).not.toBeNull();
  });

  it('el monto rápido llena el campo y deja seguir', () => {
    crear();
    tocar('$20.000.000');
    expect(html.querySelector<HTMLInputElement>('#asMonto')!.value).toBe(
      '20.000.000',
    );
    tocar('Continuar');
    expect(titulo()).toContain('Paso 2 de 3 · Tu perfil');
    expect(html.querySelector('.resumen')?.textContent).toContain(
      'Compra de cartera · $20.000.000 · Ya',
    );
  });

  it('el paso 2 pide elegir cada opción y "Otra" deja escribir la ciudad', () => {
    crear();
    llenarPaso1();
    tocar('Continuar');
    expect(titulo()).toContain('Paso 2 de 3');
    expect(html.querySelectorAll('fieldset .error').length).toBe(4);

    tocar('Empleado');
    tocar('$2 a $4 millones');
    tocar('No');
    tocar('Otra');
    expect(html.querySelector('#asCiudad')).not.toBeNull();
    tocar('Continuar');
    expect(html.textContent).toContain('Escribe tu ciudad.');
    escribir('#asCiudad', 'Pereira');
    tocar('Continuar');
    expect(titulo()).toContain('Paso 3 de 3');
  });

  it('"Atrás" vuelve sin perder lo elegido', () => {
    crear();
    llenarPaso1();
    tocar('Empleado');
    tocar('Atrás');
    expect(titulo()).toContain('Paso 1 de 3');
    tocar('Continuar');
    expect(
      html.querySelector('[aria-labelledby=lbIngreso] [aria-pressed=true]')
        ?.textContent,
    ).toContain('Empleado');
  });

  it('el botón final queda bloqueado hasta marcar la autorización', () => {
    crear();
    llenarPaso1();
    llenarPaso2();
    const boton = html.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(boton.disabled).toBeTrue();
    expect(boton.textContent).toContain('Marca la autorización');
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
    expect(boton.disabled).toBeFalse();
    expect(boton.textContent).toContain('Quiero que me asesoren');
  });

  it('muestra los errores del paso 3 al intentar enviar vacío', () => {
    crear();
    llenarPaso1();
    llenarPaso2();
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    expect(html.querySelector('#errNombre')).not.toBeNull();
    expect(html.querySelector('#errCel')).not.toBeNull();
    expect(html.querySelector('.listo')).toBeNull();
  });

  it('llega lleno desde el simulador', () => {
    crear({ producto: 'libranza', monto: '20000000', origen: 'simulador' });
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
    crear({ urgencia: 'mes' });
    llenarPaso1();
    llenarPaso2();
    escribir('#asNombre', 'Ana');
    escribir('#asCel', '300 123 4567');
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      '¡Listo! Un asesor te contactará en los próximos días',
    );
  });

  it('pide el correo si marca Correo', () => {
    crear();
    llenarPaso1();
    llenarPaso2();
    const casillas = html.querySelectorAll<HTMLInputElement>(
      '[formGroupName=canales] input',
    );
    casillas[2].click();
    fixture.detectChanges();
    expect(html.querySelector('#asCorreo')).not.toBeNull();
  });
});
