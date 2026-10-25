import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ComparaOferta } from './compara-oferta';
import { calcularOferta } from './oferta';

describe('ComparaOferta', () => {
  let fixture: ComponentFixture<ComparaOferta>;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ComparaOferta],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ComparaOferta);
    fixture.detectChanges();
    html = fixture.nativeElement;
  });

  function boton(texto: string): HTMLButtonElement {
    const encontrado = [
      ...html.querySelectorAll<HTMLButtonElement>('.respuesta button'),
    ].find((b) => b.textContent?.trim() === texto);
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  function tocar(texto: string) {
    boton(texto).click();
    fixture.detectChanges();
  }

  function escribir(valor: string) {
    const campo = html.querySelector<HTMLInputElement>('#campoRespuesta')!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.entrada button')!.click();
    fixture.detectChanges();
  }

  function error(): string {
    return html.querySelector('#errorRespuesta')?.textContent?.trim() ?? '';
  }

  function ultimoResultado(): HTMLElement {
    const todos = html.querySelectorAll<HTMLElement>('.resultado');
    return todos[todos.length - 1];
  }

  function empezarHastaQueDijeron(monto = '20.000.000') {
    tocar('Comparar mi oferta');
    tocar('Libre inversión');
    escribir(monto);
    tocar('48 meses');
  }

  it('abre con la conversación de ejemplo resuelta', () => {
    expect(html.querySelector('.cartel')?.textContent).toContain('Ejemplo');
    expect(ultimoResultado().textContent).toContain('32,22 %');
    expect(boton('Comparar mi oferta')).toBeTruthy();
  });

  it('flujo E.A. con cuota: 32,22 %, $51.913 de costos y veredicto', () => {
    empezarHastaQueDijeron();
    tocar('Una tasa efectiva anual (E.A.)');
    escribir('26,38');
    tocar('Sí');
    escribir('700.000');
    const resultado = ultimoResultado().textContent!;
    expect(resultado).toContain('32,22 % E.A.');
    expect(resultado).toContain('$51.913 al mes');
    // 32,22 % supera la usura de prueba (28,59 %).
    expect(resultado).toContain('Supera la tasa de usura');
    expect(resultado).toContain('ilegal en Colombia');
  });

  it('flujo mensual sin cuota: 1,6 % → 20,98 % E.A.', () => {
    empezarHastaQueDijeron();
    tocar('Una tasa mensual (M.V.)');
    escribir('1,6');
    expect(html.textContent).toContain(
      'Una tasa de 1,60 % mensual equivale a 20,98 % efectivo anual',
    );
    tocar('No me la dijeron');
    const resultado = ultimoResultado().textContent!;
    expect(resultado).toContain('20,98 % E.A.');
    // Por debajo de AV Villas (21,48 %): buena tasa.
    expect(resultado).toContain('Buena tasa');
  });

  it('valida el monto, la tasa mensual y la cuota', () => {
    tocar('Comparar mi oferta');
    tocar('Libre inversión');
    escribir('500.000');
    expect(error()).toBe('Escribe un monto de al menos $1.000.000.');

    escribir('20.000.000');
    tocar('48 meses');
    tocar('Una tasa mensual (M.V.)');
    escribir('26');
    expect(error()).toBe(
      'Una tasa mensual suele estar entre 0,5 % y 3 %. ¿Seguro que no es anual?',
    );

    escribir('2,1');
    tocar('Sí');
    escribir('300.000');
    expect(error()).toBe(
      'Con esa cuota no alcanzas a pagar el monto en ese plazo. Revisa los datos.',
    );
  });

  it('"Sí, quiero mejorarla" y "Ya" llevan a la asesoría con los datos', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(
      true,
    );
    empezarHastaQueDijeron();
    tocar('Solo la cuota');
    escribir('700.000');
    tocar('Sí, quiero mejorarla');
    tocar('Ya');
    expect(navegar).toHaveBeenCalledWith(['/asesoria'], {
      queryParams: {
        producto: 'libre-inversion',
        monto: 20_000_000,
        urgencia: 'ya',
        origen: 'oferta',
      },
    });
  });

  it('"Empezar de nuevo" borra la conversación', () => {
    html.querySelector<HTMLButtonElement>('.reiniciar')!.click();
    fixture.detectChanges();
    expect(html.querySelector('.cartel')).toBeNull();
    expect(html.querySelectorAll('.mensajes li').length).toBe(2);
  });
});

describe('calcularOferta', () => {
  const mejor = {
    entidad: 'AV Villas',
    tipo: 'Banco' as const,
    producto: 'libre-inversion' as const,
    tasaReal: 21.48,
    tasaAnunciada: 14.1,
  };

  it('sin costos extra cuando la cuota coincide con la tasa', () => {
    const r = calcularOferta(
      {
        producto: 'libre-inversion',
        monto: 20_000_000,
        plazo: 48,
        tipo: 'ea',
        tasaDicha: 26.38,
        tasaMensualDicha: null,
        cuota: null,
      },
      mejor,
      28.59,
    );
    expect(Math.round(r.cuota)).toBe(648_087);
    expect(r.costosMes).toBe(0);
    expect(Math.round(r.ahorro!.total)).toBe(2_090_784);
    expect(r.veredicto).toBe('alto');
  });
});
