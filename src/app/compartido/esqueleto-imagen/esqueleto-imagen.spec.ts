import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EsqueletoImagen } from './esqueleto-imagen';

@Component({
  imports: [EsqueletoImagen],
  template: `<span class="caja"
    ><img appEsqueleto src="x.webp" alt=""
  /></span>`,
})
class Prueba {}

describe('EsqueletoImagen', () => {
  it('el contenedor brilla hasta que la imagen carga o falla', () => {
    const fixture = TestBed.createComponent(Prueba);
    fixture.detectChanges();
    const caja: HTMLElement = fixture.nativeElement.querySelector('.caja');
    const img = caja.querySelector('img')!;
    // Sin cargar todavía (src que no existe: termina en error).
    if (!img.complete) {
      expect(caja.classList).toContain('img-cargando');
    }
    img.dispatchEvent(new Event('load'));
    expect(caja.classList).not.toContain('img-cargando');
  });

  it('también se quita si la imagen falla', () => {
    const fixture = TestBed.createComponent(Prueba);
    fixture.detectChanges();
    const caja: HTMLElement = fixture.nativeElement.querySelector('.caja');
    caja.classList.add('img-cargando');
    caja.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(caja.classList).not.toContain('img-cargando');
  });
});
