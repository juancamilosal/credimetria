import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TASAS_DE_PRUEBA } from '../../core/datos/tasas-prueba';
import {
  EventosTurnstile,
  TurnstileService,
} from '../../core/servicios/turnstile.service';
import { QuieroSerAliado, separar } from './quiero-ser-aliado';

describe('QuieroSerAliado', () => {
  let fixture: ComponentFixture<QuieroSerAliado>;
  let html: HTMLElement;

  async function crear() {
    TestBed.configureTestingModule({
      imports: [QuieroSerAliado],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        TASAS_DE_PRUEBA,
        {
          provide: TurnstileService,
          useValue: {
            mostrar: (_el: HTMLElement, e: EventosTurnstile) => {
              e.token('token-1');
              return Promise.resolve('w1');
            },
            reiniciar: () => {},
            quitar: () => {},
          },
        },
      ],
    });
    fixture = TestBed.createComponent(QuieroSerAliado);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    html = fixture.nativeElement;
  }

  function escribir(sel: string, valor: string) {
    const el = html.querySelector<HTMLInputElement>(sel)!;
    el.value = valor;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  function marcar(texto: string) {
    const label = [...html.querySelectorAll('.chip-opcion')].find(
      (l) => l.textContent?.trim() === texto,
    )!;
    label.querySelector('input')!.click();
    fixture.detectChanges();
  }

  const boton = () =>
    html.querySelector<HTMLButtonElement>('button[type=submit]')!;

  it('separa las listas escritas con comas sin repetir', () => {
    expect(separar(' Bogotá, Cali ,,Cali; Pasto')).toEqual([
      'Bogotá',
      'Cali',
      'Pasto',
    ]);
  });

  it('manda toda la información del asesor con las reglas y la autorización', async () => {
    await crear();
    expect(boton().disabled).toBeTrue();
    escribir('#saNombre', 'Carlos Pérez');
    escribir('#saCedula', '1020304050');
    escribir('#saCelular', '3109876543');
    escribir('#saCorreo', 'carlos@ejemplo.com');
    escribir('#saCiudad', 'Cali');
    escribir('#saTipo', 'fuerza_ventas');
    escribir('#saExperiencia', '5');
    const primera = html.querySelector('.chip-opcion')!.textContent!.trim();
    marcar(primera);
    escribir('#saOtras', 'Banco X, Banco X');
    marcar('Libranza');
    escribir('#saCiudades', 'Cali, Palmira');
    escribir('#saVinculo', 'carta');
    for (const c of html.querySelectorAll<HTMLInputElement>('.autoriza input'))
      c.click();
    fixture.detectChanges();
    expect(boton().disabled).toBeFalse();
    boton().click();
    const pedido = TestBed.inject(HttpTestingController).expectOne(
      '/api/solicitudes-aliados',
    );
    const cuerpo = pedido.request.body;
    expect(cuerpo.nombre).toBe('Carlos Pérez');
    expect(cuerpo.tipo).toBe('fuerza_ventas');
    expect(cuerpo.entidades).toEqual([primera, 'Banco X']);
    expect(cuerpo.productos).toEqual(['Libranza']);
    expect(cuerpo.ciudades).toEqual(['Cali', 'Palmira']);
    expect(cuerpo.experiencia).toBe(5);
    expect(cuerpo.aceptaReglas).toBeTrue();
    expect(cuerpo.turnstileToken).toBe('token-1');
    expect(cuerpo.autorizacion.texto).toMatch(/^Autorizo a Credimetría/);
    pedido.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      'Recibimos tu solicitud',
    );
  });
});
