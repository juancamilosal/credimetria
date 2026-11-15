import { entidadDePrueba } from '../datos/financieros-prueba';
import { armarGrafica, valorAnual } from './grafica-lineas';

const MM = 1e9;

describe('gráfica de líneas', () => {
  it('calcula la rentabilidad de cada año con su patrimonio', () => {
    expect(
      valorAnual(
        { anio: 2025, utilidad: 15 * MM, patrimonio: 100 * MM, cartera: null },
        'rentabilidad',
      ),
    ).toBeCloseTo(0.15);
    expect(
      valorAnual(
        { anio: 2025, utilidad: 1, patrimonio: null, cartera: null },
        'rentabilidad',
      ),
    ).toBeNull();
  });

  it('una línea por entidad, con un punto por año y el último en la leyenda', () => {
    const a = entidadDePrueba();
    const b = entidadDePrueba();
    b.codigo = 'otro';
    b.nombre = 'Otro';
    b.anual = [
      { anio: 2024, utilidad: -100 * MM, patrimonio: null, cartera: null },
      { anio: 2025, utilidad: 300 * MM, patrimonio: null, cartera: null },
    ];
    const g = armarGrafica([a, b], 'utilidad')!;
    expect(g.anios.map((x) => x.anio)).toEqual([2023, 2024, 2025]);
    expect(g.lineas.length).toBe(2);
    expect(g.lineas[0].puntos.length).toBe(3);
    expect(g.lineas[0].ultimo?.texto).toBe('$1,8 bill.');
    // Hay pérdidas: aparece la línea del cero.
    expect(g.cero).not.toBeNull();
    // La de "Otro" empieza en 2024 (sin 2023).
    expect(g.lineas[1].d.startsWith('M')).toBeTrue();
    expect(g.lineas[1].puntos[0].anio).toBe(2024);
    expect(g.marcas.length).toBe(5);
  });

  it('"Cuánto cambió": cada entidad frente a su primer año', () => {
    const e = entidadDePrueba();
    e.anual = [
      { anio: 2020, utilidad: 321 * MM, patrimonio: null, cartera: null },
      { anio: 2025, utilidad: 534 * MM, patrimonio: null, cartera: null },
    ];
    const g = armarGrafica([e], 'utilidad', undefined, 'cambio')!;
    expect(g.lineas[0].puntos.map((p) => p.texto)).toEqual(['0 %', '+66 %']);
    expect(g.cero).not.toBeNull();
    // La rentabilidad ya es un porcentaje: no cambia de escala.
    const r = armarGrafica(
      [entidadDePrueba()],
      'rentabilidad',
      undefined,
      'cambio',
    )!;
    expect(r.lineas[0].puntos[0].texto).toContain('%');
    expect(r.lineas[0].puntos[0].texto).not.toContain('+');
  });

  it('sin años no hay gráfica', () => {
    const e = entidadDePrueba();
    e.anual = [];
    expect(armarGrafica([e], 'utilidad')).toBeNull();
  });
});
