import { inicioDelMes, pendienteDelMes } from './mes';

describe('inicioDelMes', () => {
  it('es el día 1 a la medianoche de Colombia', () => {
    expect(inicioDelMes(new Date('2026-10-29T15:00:00Z'))).toBe(
      '2026-10-01T05:00:00.000Z',
    );
  });

  it('el 1 de noviembre a las 2 a. m. UTC todavía es octubre en Colombia', () => {
    expect(inicioDelMes(new Date('2026-11-01T02:00:00Z'))).toBe(
      '2026-10-01T05:00:00.000Z',
    );
    expect(inicioDelMes(new Date('2026-11-01T05:00:00Z'))).toBe(
      '2026-11-01T05:00:00.000Z',
    );
  });
});

describe('pendienteDelMes', () => {
  const hoy = new Date('2026-11-03T15:00:00Z');

  it('pendiente si nunca se revisó o se revisó el mes pasado', () => {
    expect(pendienteDelMes(null, hoy)).toBeTrue();
    expect(pendienteDelMes('2026-10-28T20:00:00.000Z', hoy)).toBeTrue();
  });

  it('al día si se revisó este mes', () => {
    expect(pendienteDelMes('2026-11-02T14:00:00.000Z', hoy)).toBeFalse();
  });
});
