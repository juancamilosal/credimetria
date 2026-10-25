import {
  ahorro,
  amortizacion,
  cuotaMensual,
  efectivaAnualDeMensual,
  leerNumero,
  tasaDeCuota,
  tasaMensual,
} from './credito';

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

  it('convierte una tasa mensual a efectiva anual', () => {
    expect(efectivaAnualDeMensual(2.1)).toBeCloseTo(28.32, 2);
    expect(efectivaAnualDeMensual(1.6)).toBeCloseTo(20.98, 2);
  });

  it('encuentra la tasa que corresponde a una cuota', () => {
    // $20.000.000 a 48 meses con cuota de $700.000 → 32,22 % E.A.
    expect(tasaDeCuota(20_000_000, 700_000, 48)).toBeCloseTo(32.22, 2);
    // Ida y vuelta con la cuota del documento.
    const cuota = cuotaMensual(20_000_000, 26.38, 48);
    expect(tasaDeCuota(20_000_000, cuota, 48)).toBeCloseTo(26.38, 6);
  });

  it('devuelve null si la cuota no alcanza a pagar el monto', () => {
    expect(tasaDeCuota(20_000_000, 20_000_000 / 48, 48)).toBeNull();
    expect(tasaDeCuota(20_000_000, 300_000, 48)).toBeNull();
  });

  it('arma la tabla de amortización con cuota fija y saldo final en cero', () => {
    const tabla = amortizacion(20_000_000, 26.38, 48);
    expect(tabla.length).toBe(48);
    expect(Math.round(tabla[0].cuota)).toBe(648_087);
    expect(tabla[0].interes).toBeCloseTo(20_000_000 * tasaMensual(26.38), 6);
    expect(tabla[0].capital + tabla[0].interes).toBeCloseTo(tabla[0].cuota, 6);
    expect(tabla.at(-1)!.saldo).toBe(0);
    const capital = tabla.reduce((suma, fila) => suma + fila.capital, 0);
    expect(capital).toBeCloseTo(20_000_000, 4);
    expect(Math.round(tabla.at(-1)!.cuota)).toBe(648_087);
    expect(amortizacion(0, 26.38, 48)).toEqual([]);
  });

  it('con cuota decreciente abona igual a capital y la cuota baja', () => {
    const tabla = amortizacion(20_000_000, 26.38, 48, 'decreciente');
    expect(tabla.length).toBe(48);
    expect(Math.round(tabla[0].capital)).toBe(416_667);
    expect(Math.round(tabla[0].cuota)).toBe(810_703);
    expect(Math.round(tabla.at(-1)!.cuota)).toBe(424_876);
    expect(tabla.at(-1)!.saldo).toBe(0);
    const intereses = tabla.reduce((suma, fila) => suma + fila.interes, 0);
    expect(Math.round(intereses)).toBe(9_653_893);
  });
});
