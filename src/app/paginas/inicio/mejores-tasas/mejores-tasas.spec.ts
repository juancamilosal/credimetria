import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { TestBed } from '@angular/core/testing';
import { TasasService } from '../../../core/servicios/tasas.service';
import { MejoresTasas } from './mejores-tasas';

describe('MejoresTasas', () => {
  beforeEach(async () => {
    registerLocaleData(localeEsCo);
    await TestBed.configureTestingModule({
      imports: [MejoresTasas],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }],
    }).compileComponents();
  });

  function entidades(html: HTMLElement): string[] {
    return [...html.querySelectorAll('.ranking h3')].map(
      (h) => h.textContent?.trim() ?? '',
    );
  }

  it('muestra las 3 mejores de libre inversión al abrir', () => {
    const fixture = TestBed.createComponent(MejoresTasas);
    fixture.detectChanges();
    const esperadas = TestBed.inject(TasasService)
      .mejores('libre-inversion')
      .map((t) => t.entidad);
    expect(entidades(fixture.nativeElement)).toEqual(esperadas);
  });

  it('cambia el ranking al elegir otra pestaña', () => {
    const fixture = TestBed.createComponent(MejoresTasas);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    html.querySelector<HTMLButtonElement>('#pestana-vivienda')!.click();
    fixture.detectChanges();
    const esperadas = TestBed.inject(TasasService)
      .mejores('vivienda')
      .map((t) => t.entidad);
    expect(entidades(html)).toEqual(esperadas);
    expect(
      html.querySelector('#pestana-vivienda')?.getAttribute('aria-selected'),
    ).toBe('true');
  });
});
