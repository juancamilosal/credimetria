import { TestBed } from '@angular/core/testing';
import { DocumentoPdf } from '../modelos/documento';
import {
  DocumentoRepetido,
  DocumentosAdminService,
  huellaArchivo,
} from './documentos-admin.service';
import { SesionAdmin } from './sesion-admin.service';

const doc = (cambios: Partial<DocumentoPdf>): DocumentoPdf => ({
  id: 1,
  fuente: 2,
  archivo: { id: 'f1', filename_download: 'tasas.pdf', filesize: 1000 },
  estado: 'nuevo',
  vigente_desde: null,
  origen: 'manual',
  huella: null,
  notas: null,
  date_created: null,
  user_created: null,
  ...cambios,
});

describe('DocumentosAdminService', () => {
  let pedir: jasmine.Spy;
  let servicio: DocumentosAdminService;

  beforeEach(() => {
    pedir = jasmine.createSpy('pedir');
    TestBed.configureTestingModule({
      providers: [{ provide: SesionAdmin, useValue: { pedir } }],
    });
    servicio = TestBed.inject(DocumentosAdminService);
  });

  it('calcula la huella SHA-256 del archivo', async () => {
    expect(await huellaArchivo(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('sube el PDF y lo deja como nuevo', async () => {
    pedir.and.callFake(async (metodo: string, ruta: string) => {
      if (metodo === 'GET') return [];
      if (ruta === '/files') return { id: 'archivo-1' };
      return doc({ id: 9 });
    });
    const pdf = new File(['%PDF-1'], 'bbva.pdf', { type: 'application/pdf' });
    const nuevo = await servicio.cargar(2, pdf, '2026-10-05');
    expect(nuevo.id).toBe(9);
    const [, , cuerpo] = pedir.calls.mostRecent().args;
    expect(cuerpo).toEqual(
      jasmine.objectContaining({
        fuente: 2,
        archivo: 'archivo-1',
        estado: 'nuevo',
        vigente_desde: '2026-10-05',
        origen: 'manual',
        huella: await huellaArchivo(pdf),
      }),
    );
  });

  it('no sube un PDF repetido', async () => {
    pedir.and.resolveTo([doc({ estado: 'actual' })]);
    const pdf = new File(['%PDF-1'], 'bbva.pdf');
    await expectAsync(servicio.cargar(2, pdf, null)).toBeRejectedWith(
      jasmine.any(DocumentoRepetido),
    );
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('no acepta un PDF que ya es de otro banco', async () => {
    pedir.and.callFake(async (_m: string, ruta: string) =>
      ruta.startsWith('/items/documentos')
        ? [doc({ fuente: 7 })]
        : [
            { id: 2, entidad: 'bbva' },
            { id: 7, entidad: 'davivienda' },
          ],
    );
    const pdf = new File(['%PDF-1'], 'otro.pdf');
    await expectAsync(servicio.cargar(2, pdf, null)).toBeRejectedWith(
      jasmine.any(DocumentoRepetido),
    );
  });

  it('el mismo PDF de otro producto del banco se usa sin subirlo otra vez', async () => {
    pedir.and.callFake(async (metodo: string, ruta: string) => {
      if (metodo === 'GET' && ruta.startsWith('/items/documentos'))
        return [
          doc({
            fuente: 11,
            archivo: {
              id: 'pdf-davivienda',
              filename_download: 't.pdf',
              filesize: 1,
            },
          }),
        ];
      if (metodo === 'GET')
        return [
          { id: 11, entidad: 'davivienda' },
          { id: 25, entidad: 'davivienda' },
        ];
      return doc({ id: 43, fuente: 25 });
    });
    const pdf = new File(['%PDF-1'], 'davivienda.pdf');
    const nuevo = await servicio.cargar(25, pdf, '2026-10-19');
    expect(nuevo.id).toBe(43);
    expect(
      pedir.calls.allArgs().some(([, ruta]) => ruta === '/files'),
    ).toBeFalse();
    const [, , cuerpo] = pedir.calls.mostRecent().args;
    expect(cuerpo).toEqual(
      jasmine.objectContaining({ fuente: 25, archivo: 'pdf-davivienda' }),
    );
  });

  it('al usar el nuevo como actual, el actual pasa a anterior', async () => {
    pedir.and.resolveTo(undefined);
    await servicio.usarComoActual(
      doc({ id: 5 }),
      doc({ id: 3, estado: 'actual' }),
    );
    expect(pedir.calls.allArgs()).toEqual([
      ['PATCH', '/items/documentos/3', { estado: 'anterior' }],
      ['PATCH', '/items/documentos/5', { estado: 'actual' }],
    ]);
  });

  it('cambia el archivo de un PDF y borra el anterior', async () => {
    pedir.and.callFake(async (metodo: string, ruta: string) => {
      if (metodo === 'GET') return [];
      if (ruta === '/files') return { id: 'nuevo' };
      if (metodo === 'PATCH')
        return doc({
          id: 5,
          archivo: { id: 'nuevo', filename_download: 'b.pdf', filesize: 1 },
        });
      return undefined;
    });
    const pdf = new File(['%PDF-2'], 'b.pdf');
    const cambiado = await servicio.reemplazarArchivo(doc({ id: 5 }), pdf);
    expect(cambiado.archivo.id).toBe('nuevo');
    const llamadas = pedir.calls
      .allArgs()
      .map(([m, r]) => `${m} ${r.split('?')[0]}`);
    expect(llamadas).toEqual([
      'GET /items/documentos',
      'POST /files',
      'PATCH /items/documentos/5',
      'GET /items/documentos',
      'DELETE /files/f1',
    ]);
  });

  it('al descartar no borra un archivo que usa otro producto', async () => {
    pedir.and.callFake(async (metodo: string) =>
      metodo === 'GET' ? [{ id: 8 }] : undefined,
    );
    await servicio.descartar(doc({ id: 5 }));
    const llamadas = pedir.calls
      .allArgs()
      .map(([m, r]) => `${m} ${r.split('?')[0]}`);
    expect(llamadas).toEqual([
      'DELETE /items/documentos/5',
      'GET /items/documentos',
    ]);
  });
});
