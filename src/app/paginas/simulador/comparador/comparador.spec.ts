import { TASAS_DE_PRUEBA } from '../../../core/datos/tasas-prueba';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Comparador } from './comparador';

describe('Comparador', () => {
  let fixture: ComponentFixture<Comparador>;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TASAS_DE_PRUEBA] });
    fixture = TestBed.createComponent(Comparador);
    fixture.componentRef.setInput('producto', 'libre-inversion');
    fixture.componentRef.setInput('monto', 20_000_000);
    fixture.componentRef.setInput('plazo', 48);
    fixture.detectChanges();
    html = fixture.nativeElement;
  });

  function elegir(id: string, entidad: string) {
    const select = html.querySelector<HTMLSelectElement>(id)!;
    select.value = entidad;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('Banco de Bogotá contra AV Villas: con B te ahorras $2.090.784', () => {
    elegir('#entidadA', 'Banco de Bogotá');
    elegir('#entidadB', 'AV Villas');
    expect(html.querySelector('#cuotaA')?.textContent).toContain('$648.087');
    expect(html.querySelector('#cuotaB')?.textContent).toContain('$604.529');
    const resultado = html.querySelector('.resultado')!.textContent!;
    expect(resultado).toContain('Con B (AV Villas) te ahorras');
    expect(resultado).toContain('$2.090.784');
    expect(resultado).toContain('$43.558 al mes');
  });

  it('al revés, dice que A es la más barata', () => {
    elegir('#entidadA', 'AV Villas');
    elegir('#entidadB', 'Banco de Bogotá');
    const resultado = html.querySelector('.resultado')!.textContent!;
    expect(resultado).toContain('Con A (AV Villas) te ahorras');
    expect(resultado).toContain('$2.090.784');
  });

  it('arranca con la que más cobra contra la que menos y sigue al producto', () => {
    expect(fixture.componentInstance.entidadA()).toBe('Banco de Bogotá');
    expect(fixture.componentInstance.entidadB()).toBe('AV Villas');
    fixture.componentRef.setInput('producto', 'vivienda');
    fixture.detectChanges();
    expect(fixture.componentInstance.entidadB()).toBe(
      'Fondo Nacional del Ahorro',
    );
  });
});
