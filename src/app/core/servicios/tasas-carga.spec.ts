import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CARGADOR_TASAS, DatosTasas, TasasService } from './tasas.service';

const DATOS: DatosTasas = {
  corte: {
    fuente: 'Superintendencia Financiera de Colombia',
    fecha: '2026-10-16',
    ejemplo: false,
  },
  tasas: [
    {
      entidad: 'Banco de Bogotá',
      tipo: 'Banco',
      producto: 'libre-inversion',
      tasaReal: 22.71,
      tasaAnunciada: 14.49,
      tasaHasta: 28.59,
      hastaUsura: true,
      vigencia: '2026-10-15',
      pdf: 'https://banco/tasas.pdf',
      logo: '/api/logos/banco-de-bogota',
    },
    {
      entidad: 'AV Villas',
      tipo: 'Banco',
      producto: 'libre-inversion',
      tasaReal: 19.57,
      tasaAnunciada: 16,
      tasaHasta: 28.59,
    },
  ],
};

describe('TasasService · carga', () => {
  it('en el navegador pide /api/tasas a la página, no a Directus', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const servicio = TestBed.inject(TasasService);
    const http = TestBed.inject(HttpTestingController);
    const carga = servicio.cargar();
    http.expectOne('/api/tasas').flush(DATOS);
    await carga;
    const [primera, segunda] = servicio.ranking('libre-inversion');
    expect(primera.entidad).toBe('AV Villas');
    expect(segunda.hastaUsura).toBeTrue();
    expect(segunda.logo).toBe('/api/logos/banco-de-bogota');
    expect(servicio.corte().fecha).toBe('2026-10-16');
    http.verify();
  });

  it('en el servidor las lee directo y las deja en la página para el navegador', async () => {
    const cargador = jasmine.createSpy('cargador').and.resolveTo(DATOS);
    TestBed.configureTestingModule({
      providers: [{ provide: CARGADOR_TASAS, useValue: cargador }],
    });
    const servicio = TestBed.inject(TasasService);
    await servicio.cargar();
    expect(cargador).toHaveBeenCalled();
    expect(servicio.mejor('libre-inversion')?.entidad).toBe('AV Villas');
    const estado = TestBed.inject(TransferState);
    expect(
      estado.get(makeStateKey<DatosTasas>('credimetria-tasas'), null),
    ).toEqual(DATOS);
  });

  it('si la página ya trae las tasas, el navegador no las vuelve a pedir', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(TransferState).set(
      makeStateKey<DatosTasas>('credimetria-tasas'),
      DATOS,
    );
    const servicio = TestBed.inject(TasasService);
    await servicio.cargar();
    TestBed.inject(HttpTestingController).verify();
    expect(servicio.ranking('libre-inversion').length).toBe(2);
  });

  it('si no hay tasas, la página lo sabe', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const servicio = TestBed.inject(TasasService);
    const http = TestBed.inject(HttpTestingController);
    const carga = servicio.cargar();
    http.expectOne('/api/tasas').flush({}, { status: 503, statusText: 'No' });
    await carga;
    expect(servicio.ranking('libre-inversion')).toEqual([]);
    expect(servicio.sinConexion()).toBeTrue();
  });
});
