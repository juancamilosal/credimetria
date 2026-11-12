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
import { AliadosService } from '../../core/servicios/aliados.service';
import {
  EventosTurnstile,
  TurnstileService,
} from '../../core/servicios/turnstile.service';
import { ALEXANDRA, servicioFalso } from '../../core/datos/aliados-prueba';
import { ReportarAsesor } from './reportar-asesor';

describe('ReportarAsesor', () => {
  let fixture: ComponentFixture<ReportarAsesor>;
  let html: HTMLElement;
  let reinicios = 0;

  async function crear(params: Record<string, string> = {}) {
    reinicios = 0;
    TestBed.configureTestingModule({
      imports: [ReportarAsesor],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AliadosService, useValue: servicioFalso([ALEXANDRA]) },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
        {
          provide: TurnstileService,
          useValue: {
            mostrar: (_el: HTMLElement, e: EventosTurnstile) => {
              e.token('token-1');
              return Promise.resolve('w1');
            },
            reiniciar: () => reinicios++,
            quitar: () => {},
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ReportarAsesor);
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

  function llenar() {
    html.querySelector<HTMLInputElement>('.motivos input[type=radio]')!.click();
    escribir('#rpDescripcion', 'Me pidió 200.000 pesos para aprobar.');
    escribir('#rpNombre', 'Ana Gómez');
    escribir('#rpCorreo', 'ana@ejemplo.com');
    html.querySelector<HTMLInputElement>('.autoriza input')!.click();
    fixture.detectChanges();
  }

  const boton = () =>
    html.querySelector<HTMLButtonElement>('button[type=submit]')!;

  it('lista los asesores de Directus y preselecciona el del enlace', async () => {
    await crear({ asesor: 'alexandra-rojas-garcia' });
    const opciones = [...html.querySelectorAll('#rpAsesor option')].map((o) =>
      o.textContent!.trim(),
    );
    expect(opciones).toContain('Alexandra Rojas García · Fuerza de ventas');
    expect(opciones).toContain('No está en la lista / no sé quién es');
    expect(html.querySelector<HTMLSelectElement>('#rpAsesor')!.value).toBe(
      'alexandra-rojas-garcia',
    );
  });

  it('manda el reporte con el asesor, el motivo, la autorización y el token', async () => {
    await crear({ asesor: 'alexandra-rojas-garcia' });
    const http = TestBed.inject(HttpTestingController);
    expect(boton().disabled).toBeTrue();
    llenar();
    expect(boton().disabled).toBeFalse();
    boton().click();
    const pedido = http.expectOne('/api/reportes-asesores');
    expect(pedido.request.body.asesor).toBe('alexandra-rojas-garcia');
    expect(pedido.request.body.asesorNombre).toBeNull();
    expect(pedido.request.body.motivo).toBe('cobro_adelantado');
    expect(pedido.request.body.turnstileToken).toBe('token-1');
    expect(pedido.request.body.autorizacion.texto).toMatch(
      /^Autorizo a Credimetría/,
    );
    pedido.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(reinicios).toBe(1);
    expect(html.querySelector('.listo h1')?.textContent).toContain(
      'Recibimos tu reporte',
    );
    expect(html.textContent).toContain('sobre Alexandra Rojas García');
  });

  it('si el asesor no está en la lista pide su nombre', async () => {
    await crear();
    escribir('#rpAsesor', 'otro');
    llenar();
    expect(boton().disabled).toBeTrue();
    escribir('#rpAsesorNombre', 'Juan Pérez');
    expect(boton().disabled).toBeFalse();
    boton().click();
    const pedido = TestBed.inject(HttpTestingController).expectOne(
      '/api/reportes-asesores',
    );
    expect(pedido.request.body.asesor).toBeNull();
    expect(pedido.request.body.asesorNombre).toBe('Juan Pérez');
  });

  it('si el servidor falla lo dice y se queda en el formulario', async () => {
    await crear({ asesor: 'alexandra-rojas-garcia' });
    llenar();
    boton().click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/reportes-asesores')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(html.querySelector('.listo')).toBeNull();
    expect(html.querySelector('.fallo')?.textContent).toContain(
      'No pudimos enviar tu reporte',
    );
  });
});
