import { cuotaMensual, resumenCredito, tasaMensual } from './credito';

describe('credito', () => {
  it('convierte la tasa E.A. a mensual', () => {
    expect(tasaMensual(23.28) * 100).toBeCloseTo(1.759, 3);
  });

  it('calcula la cuota fija del ejemplo del documento', () => {
    // $20.000.000 a 48 meses al 23,28 % E.A. → $620.523
    expect(Math.round(cuotaMensual(20_000_000, 23.28, 48))).toBe(620_523);
  });

  it('con tasa cero reparte el monto en partes iguales', () => {
    expect(cuotaMensual(1_200_000, 0, 12)).toBe(100_000);
  });

  it('devuelve cero con monto o plazo inválidos', () => {
    expect(cuotaMensual(0, 20, 12)).toBe(0);
    expect(cuotaMensual(1_000_000, 20, 0)).toBe(0);
  });

  it('suma intereses y total pagado', () => {
    const resumen = resumenCredito(20_000_000, 23.28, 48);
    expect(resumen.totalPagado).toBeCloseTo(resumen.cuota * 48, 6);
    expect(resumen.totalIntereses).toBeCloseTo(
      resumen.totalPagado - 20_000_000,
      6,
    );
  });
});
