import { ahorro, cuotaMensual, leerNumero, tasaMensual } from './credito';

describe('credito', () => {
  it('convierte la tasa E.A. a mensual', () => {
    expect(tasaMensual(23.28) * 100).toBeCloseTo(1.759, 3);
  });

  it('da las cuotas del documento de pantallas', () => {
    // $20.000.000 a 48 meses: 26,38 % → $648.087 y 21,48 % → $604.529
    expect(Math.round(cuotaMensual(20_000_000, 26.38, 48))).toBe(648_087);
    expect(Math.round(cuotaMensual(20_000_000, 21.48, 48))).toBe(604_529);
  });

  it('calcula el ahorro del documento de pantallas', () => {
    const resultado = ahorro(20_000_000, 26.38, 21.48, 48);
    expect(Math.round(resultado.mes)).toBe(43_558);
    expect(Math.round(resultado.total)).toBe(2_090_784);
  });

  it('con tasa cero reparte el monto en partes iguales', () => {
    expect(cuotaMensual(1_200_000, 0, 12)).toBe(100_000);
  });

  it('devuelve cero con monto, plazo o tasa inválidos', () => {
    expect(cuotaMensual(0, 20, 12)).toBe(0);
    expect(cuotaMensual(1_000_000, 20, 0)).toBe(0);
    expect(cuotaMensual(1_000_000, -1, 12)).toBe(0);
  });

  it('lee números escritos a la colombiana', () => {
    expect(leerNumero('20.000.000')).toBe(20_000_000);
    expect(leerNumero('$ 1.500.000')).toBe(1_500_000);
    expect(leerNumero('26,38')).toBe(26.38);
    expect(leerNumero('')).toBe(0);
  });
});
