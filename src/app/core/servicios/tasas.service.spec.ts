import {
  CORTE_PRUEBA,
  TASAS_DE_PRUEBA,
  TASAS_PRUEBA,
} from '../datos/tasas-prueba';
import { TestBed } from '@angular/core/testing';
import { TASAS_INICIALES, TasasService } from './tasas.service';

describe('TasasService', () => {
  let servicio: TasasService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TASAS_DE_PRUEBA] });
    servicio = TestBed.inject(TasasService);
  });

  it('ordena cada producto de menor a mayor tasa real', () => {
    for (const { id } of servicio.productos) {
      const ranking = servicio.ranking(id);
      expect(ranking.length).toBeGreaterThan(0);
      const tasas = ranking.filter((t) => !t.sinReporte).map((t) => t.tasaReal);
      expect(tasas).toEqual([...tasas].sort((a, b) => a - b));
    }
  });

  it('las entidades sin reporte a la Superfinanciera van al final', () => {
    const ranking = servicio.ranking('leasing-no-vis');
    expect(ranking.at(-1)?.sinReporte).toBeTrue();
    expect(servicio.mejor('leasing-no-vis')?.sinReporte).toBeFalsy();
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

  it('lista cada entidad una vez, con su logo si lo tiene', () => {
    TestBed.resetTestingModule();
    const [a, b] = TASAS_PRUEBA;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TASAS_INICIALES,
          useValue: {
            corte: CORTE_PRUEBA,
            tasas: [
              { ...b, entidad: 'Zeta', logo: null },
              { ...a, entidad: 'Alfa', logo: null },
              {
                ...a,
                entidad: 'Alfa',
                producto: 'libranza',
                logo: '/api/logos/alfa',
              },
            ],
          },
        },
      ],
    });
    expect(TestBed.inject(TasasService).entidadesConLogo()).toEqual([
      { nombre: 'Alfa', logo: '/api/logos/alfa' },
      { nombre: 'Zeta', logo: null },
    ]);
  });
});
