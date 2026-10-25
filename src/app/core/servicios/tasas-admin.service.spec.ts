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
});
