import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ApplicationRef,
  PLATFORM_ID,
  TransferState,
  makeStateKey,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DatosFinancieros } from '../modelos/financiero';
import {
  CARGADOR_FINANCIEROS,
  FinancierosService,
} from './financieros.service';

const DATOS: DatosFinancieros = {
  fuente: 'Superintendencia Financiera de Colombia',
  consulta: '2026-11-26',
  corte: '2026-08-31',
  entidades: [],
};
const CLAVE = makeStateKey<DatosFinancieros>('credimetria-financieros');

describe('FinancierosService · carga', () => {
  it('en el servidor, con cargar(true), las lee directo y las deja en la página', async () => {
    const cargador = jasmine.createSpy('cargador').and.resolveTo(DATOS);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: CARGADOR_FINANCIEROS, useValue: cargador },
      ],
    });
    const servicio = TestBed.inject(FinancierosService);
    servicio.cargar(true);
    // El servidor espera a las cifras antes de entregar la página.
    await TestBed.inject(ApplicationRef).whenStable();
    expect(cargador).toHaveBeenCalled();
    expect(servicio.datos()).toEqual(DATOS);
    expect(servicio.cargando()).toBeFalse();
    expect(TestBed.inject(TransferState).get(CLAVE, null)).toEqual(DATOS);
  });

  it('en el servidor, con cargar() (el inicio), no las lee', () => {
    const cargador = jasmine.createSpy('cargador').and.resolveTo(DATOS);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: CARGADOR_FINANCIEROS, useValue: cargador },
      ],
    });
    TestBed.inject(FinancierosService).cargar();
    expect(cargador).not.toHaveBeenCalled();
  });

  it('en el navegador usa las de la página y no pide /api/financieros', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(TransferState).set(CLAVE, DATOS);
    const servicio = TestBed.inject(FinancierosService);
    servicio.cargar();
    expect(servicio.datos()).toEqual(DATOS);
    TestBed.inject(HttpTestingController).verify();
  });

  it('en el navegador, sin cifras en la página, pide /api/financieros', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const servicio = TestBed.inject(FinancierosService);
    servicio.cargar();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/financieros')
      .flush(DATOS);
    expect(servicio.datos()).toEqual(DATOS);
    expect(servicio.cargando()).toBeFalse();
  });
});
