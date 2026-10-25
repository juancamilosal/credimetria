import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DIRECTUS_URL } from '../config/directus';
import { TasasService } from './tasas.service';

describe('TasasService · carga desde Directus', () => {
  it('une la tasa publicada del PDF con el promedio de la Superfinanciera', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIRECTUS_URL, useValue: 'https://d' },
      ],
    });
    const servicio = TestBed.inject(TasasService);
    const http = TestBed.inject(HttpTestingController);
    const carga = servicio.cargar();
    http
      .expectOne((r) => r.url.startsWith('https://d/items/tasas_publicadas'))
      .flush({
        data: [
          {
            producto: 'libre-inversion',
            ea_desde: '14.4900',
            ea_hasta: '28.5900',
            hasta_origen: 'usura',
            vigente_desde: '2026-10-15',
            entidad: {
              codigo: 'banco-de-bogota',
              nombre: 'Banco de Bogotá',
              tipo: 'Banco',
              logo: 'l1',
            },
            fuente: { url: 'https://banco/tasas.pdf' },
          },
          {
            producto: 'libre-inversion',
            ea_desde: '16.0000',
            ea_hasta: '28.5900',
            hasta_origen: 'entidad',
            vigente_desde: '2026-10-01',
            entidad: {
              codigo: 'av-villas',
              nombre: 'AV Villas',
              tipo: 'Banco',
              logo: null,
            },
            fuente: null,
          },
        ],
      });
    http
      .expectOne((r) => r.url.startsWith('https://d/items/tasas_promedio'))
      .flush({
        data: [
          {
            entidad: 'banco-de-bogota',
            producto: 'libre-inversion',
            tasa_ea: '22.7100',
            corte: '2026-10-16',
          },
          {
            entidad: 'av-villas',
            producto: 'libre-inversion',
            tasa_ea: '19.5700',
            corte: '2026-10-16',
          },
        ],
      });
    await carga;
    const [primera, segunda] = servicio.ranking('libre-inversion');
    expect(primera.entidad).toBe('AV Villas');
    expect(primera.tasaReal).toBe(19.57);
    expect(segunda).toEqual(
      jasmine.objectContaining({
        tasaReal: 22.71,
        tasaAnunciada: 14.49,
        tasaHasta: 28.59,
        hastaUsura: true,
        vigencia: '2026-10-15',
        pdf: 'https://banco/tasas.pdf',
        logo: 'https://d/assets/l1?height=56&fit=inside&format=webp',
      }),
    );
    expect(servicio.corte().fecha).toBe('2026-10-16');
    expect(servicio.corte().ejemplo).toBeFalse();
  });

  it('si Directus no responde, la página queda sin tasas y lo sabe', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DIRECTUS_URL, useValue: 'https://d' },
      ],
    });
    const servicio = TestBed.inject(TasasService);
    const http = TestBed.inject(HttpTestingController);
    const carga = servicio.cargar();
    for (const r of http.match(() => true))
      r.flush({}, { status: 403, statusText: 'Forbidden' });
    await carga;
    expect(servicio.ranking('libre-inversion')).toEqual([]);
    expect(servicio.sinConexion()).toBeTrue();
  });
});
