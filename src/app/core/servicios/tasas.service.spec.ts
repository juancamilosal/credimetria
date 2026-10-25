import { TestBed } from '@angular/core/testing';
import { TasasService } from './tasas.service';

describe('TasasService', () => {
  let servicio: TasasService;

  beforeEach(() => {
    servicio = TestBed.inject(TasasService);
  });

  it('ordena cada producto de menor a mayor tasa real', () => {
    for (const { id } of servicio.productos) {
      const tasas = servicio.ranking(id).map((t) => t.tasaReal);
      expect(tasas.length).toBeGreaterThan(0);
      expect(tasas).toEqual([...tasas].sort((a, b) => a - b));
    }
  });

  it('filtra por tipo de entidad', () => {
    const cooperativas = servicio.ranking('libre-inversion', 'Cooperativa');
    expect(cooperativas.length).toBeGreaterThan(0);
    expect(cooperativas.every((t) => t.tipo === 'Cooperativa')).toBeTrue();
  });

  it('la mejor de libre inversión es AV Villas con 21,48 %', () => {
    const mejor = servicio.mejor('libre-inversion');
    expect(mejor?.entidad).toBe('AV Villas');
    expect(mejor?.tasaReal).toBe(21.48);
  });

  it('reconoce los productos válidos', () => {
    expect(servicio.esProducto('libranza')).toBeTrue();
    expect(servicio.esProducto('hipoteca')).toBeFalse();
    expect(servicio.esProducto(null)).toBeFalse();
  });
});
