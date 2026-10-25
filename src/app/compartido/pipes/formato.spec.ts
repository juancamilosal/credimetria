import { formatoPesos, formatoTasa, PuntosPipe } from './formato';

describe('formato', () => {
  it('escribe pesos con punto de miles', () => {
    expect(formatoPesos(20_000_000)).toBe('$20.000.000');
    expect(formatoPesos(648_086.8)).toBe('$648.087');
  });

  it('escribe tasas con coma decimal', () => {
    expect(formatoTasa(21.48)).toBe('21,48 %');
    expect(formatoTasa(14.1)).toBe('14,10 %');
    expect(formatoTasa(null)).toBe('—');
  });

  it('escribe la diferencia en puntos', () => {
    expect(new PuntosPipe().transform(21.48 - 14.1)).toBe('+7,38 pts');
  });
});
