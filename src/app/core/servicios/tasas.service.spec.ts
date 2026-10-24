import { TestBed } from '@angular/core/testing';
import { TasasService } from './tasas.service';

describe('TasasService', () => {
  let servicio: TasasService;

  beforeEach(() => {
    servicio = TestBed.inject(TasasService);
  });

  it('devuelve las 3 mejores tasas ordenadas de menor a mayor', () => {
    for (const { id } of servicio.productos) {
      const mejores = servicio.mejores(id);
      expect(mejores.length).toBe(3);
      expect(mejores.every((t) => t.producto === id)).toBeTrue();
      expect(mejores.map((t) => t.tasaReal)).toEqual(
        [...mejores.map((t) => t.tasaReal)].sort((a, b) => a - b),
      );
    }
  });

  it('la mejor tasa no supera el promedio del producto', () => {
    expect(servicio.mejores('libre-inversion')[0].tasaReal).toBeLessThanOrEqual(
      servicio.promedio('libre-inversion'),
    );
  });

  it('encuentra la mayor brecha entre tasa anunciada y real', () => {
    const brecha = servicio.mayorBrecha('libre-inversion');
    expect(brecha?.entidad).toBe('AV Villas');
  });
});
