import { TestBed } from '@angular/core/testing';
import { DocumentoPdf } from '../modelos/documento';
import { TasaAdmin } from '../modelos/tasa-admin';
import { SesionAdmin } from './sesion-admin.service';
import { TasasAdminService } from './tasas-admin.service';

describe('TasasAdminService', () => {
  it('al aprobar, lo publicado y el PDF actual pasan a anteriores', async () => {
    const pedir = jasmine
      .createSpy('pedir')
      .and.callFake(async () => ({ id: 2, valor_desde: '1.7700' }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SesionAdmin,
          useValue: { pedir, usuario: () => ({ id: 'u1' }) },
        },
      ],
    });
    const servicio = TestBed.inject(TasasAdminService);
    const nueva = { id: 2, documento: { id: 11 } } as TasaAdmin;
    const publicada = { id: 1 } as TasaAdmin;
    const pdfs = [
      { id: 11, estado: 'nuevo' },
      { id: 10, estado: 'actual' },
      { id: 9, estado: 'anterior' },
    ] as DocumentoPdf[];

    const aprobada = await servicio.aprobar(nueva, publicada, pdfs);

    const llamadas = pedir.calls
      .allArgs()
      .map(([m, ruta, cuerpo]) => [m, ruta.split('?')[0], cuerpo.estado]);
    expect(llamadas).toEqual([
      ['PATCH', '/items/tasas_publicadas/1', 'anterior'],
      ['PATCH', '/items/documentos/10', 'anterior'],
      ['PATCH', '/items/documentos/11', 'actual'],
      ['PATCH', '/items/tasas_publicadas/2', 'publicada'],
    ]);
    expect(pedir.calls.mostRecent().args[2].revisada_por).toBe('u1');
    expect(aprobada.valor_desde).toBe(1.77);
  });

  it('al guardar la usura pone el "hasta" nuevo solo donde es el tope', async () => {
    const pedir = jasmine
      .createSpy('pedir')
      .and.callFake(async (_m: string, ruta: string, cuerpo: unknown) =>
        ruta.startsWith('/items/tasas_publicadas')
          ? (cuerpo as object[]).map((c) => ({ ...c, ea_desde: '20.0000' }))
          : null,
      );
    TestBed.configureTestingModule({
      providers: [{ provide: SesionAdmin, useValue: { pedir } }],
    });
    const servicio = TestBed.inject(TasasAdminService);
    const tasa = (cambios: Partial<TasaAdmin>) =>
      ({
        producto: 'libranza',
        hasta_origen: 'usura',
        estado: 'publicada',
        unidad: 'MV',
        ...cambios,
      }) as TasaAdmin;
    const tasas = [
      tasa({ id: 1 }),
      tasa({ id: 2, estado: 'por_revisar', unidad: 'EA' }),
      tasa({ id: 3, hasta_origen: 'entidad' }),
      tasa({ id: 4, estado: 'anterior' }),
      tasa({ id: 5, producto: 'vivienda-vis' }),
    ];

    const cambiadas = await servicio.guardarUsura(
      { tasa: 28.34, mes: '2026-11-01' },
      tasas,
    );

    expect(pedir.calls.argsFor(0)).toEqual([
      'PATCH',
      '/items/usura',
      { tasa_ea: 28.34, mes: '2026-11-01' },
    ]);
    expect(pedir.calls.argsFor(1)[2]).toEqual([
      { id: 1, ea_hasta: 28.34, valor_hasta: 2.1 },
      { id: 2, ea_hasta: 28.34, valor_hasta: 28.34 },
    ]);
    expect(cambiadas.map((t) => t.id)).toEqual([1, 2]);
    expect(cambiadas[0].ea_desde).toBe(20);
  });
});
