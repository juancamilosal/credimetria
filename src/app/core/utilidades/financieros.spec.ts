import { entidadDePrueba } from '../datos/financieros-prueba';
import {
  analisisAutomatico,
  cambio,
  mesesCortos,
  periodoDelAnio,
  pesosCortos,
  pesosGrandes,
  porcentaje,
} from './financieros';

const MM = 1e9;

describe('utilidades de estados financieros', () => {
  it('escribe pesos grandes en billones o millones', () => {
    expect(pesosGrandes(1628.9 * MM)).toBe('$1,63 billones');
    expect(pesosGrandes(820.5 * MM)).toBe('$820.500 millones');
    expect(pesosGrandes(-41.6 * MM)).toBe('−$41.600 millones');
    expect(porcentaje(0.156)).toBe('15,6 %');
    expect(periodoDelAnio('2026-08-31')).toBe('enero a agosto de 2026');
    expect(periodoDelAnio('2026-01-31')).toBe('enero de 2026');
    expect(mesesCortos('2026-08-31')).toBe('ene–ago');
    expect(pesosCortos(1833.5 * MM)).toBe('$1,8 bill.');
    expect(pesosCortos(852.7 * MM)).toBe('$853 mil mill.');
    expect(pesosCortos(-41.6 * 1e6)).toBe('−$42 mill.');
    expect(cambio(0.5932)).toBe('+59 %');
    expect(cambio(-0.006)).toBe('−1 %');
    expect(cambio(13.64)).toBe('+300 % o más');
    expect(cambio(-11.3, true)).toBe('−300 %+');
  });

  it('Davivienda: gana 59 % más, presta más y es rentable', () => {
    const a = analisisAutomatico(entidadDePrueba());
    expect(a.titular).toBe('Ganó 59 % más que el año pasado');
    expect(a.tendencia).toBe('mejora');
    expect(a.puntos.map((p) => p.tipo)).toEqual([
      'dato',
      'fortaleza',
      'fortaleza',
    ]);
    expect(a.puntos[0].texto).toBe(
      'Utilidad de enero a agosto de 2026: $1,63 billones (el año pasado, $1,02 billones)',
    );
    expect(a.puntos[1].texto).toBe(
      'Prestó 13 % más: su cartera pasó de $103,82 billones a $116,95 billones',
    );
    expect(a.puntos[2].texto).toBe(
      'Rentabilidad de 15,6 % al año sobre su patrimonio',
    );
  });

  it('casi igual, menos, de pérdidas a ganancias y pérdidas', () => {
    expect(
      analisisAutomatico(entidadDePrueba({ variacionUtilidad: -0.006 }))
        .titular,
    ).toBe('Ganó casi lo mismo que el año pasado');
    const baja = analisisAutomatico(
      entidadDePrueba({ variacionUtilidad: -0.2 }),
    );
    expect(baja.titular).toBe('Ganó 20 % menos que el año pasado');
    expect(baja.tendencia).toBe('empeora');
    expect(
      analisisAutomatico(entidadDePrueba({ utilidadAnterior: -5 * MM }))
        .titular,
    ).toBe('Pasó de pérdidas a ganancias');
    const perdida = analisisAutomatico(
      entidadDePrueba({ utilidad: -10 * MM, rentabilidad: -0.01 }),
    );
    expect(perdida.titular).toBe('Lleva pérdidas este año');
    expect(perdida.puntos[0].tipo).toBe('alerta');
    expect(perdida.puntos.at(-1)?.texto).toContain('Rentabilidad negativa');
  });

  it('avisa los años con pérdidas', () => {
    const e = entidadDePrueba();
    e.anual = [
      { anio: 2023, utilidad: -1 },
      { anio: 2024, utilidad: -2 },
      { anio: 2025, utilidad: 3 },
    ];
    expect(analisisAutomatico(e).puntos.at(-1)).toEqual({
      tipo: 'alerta',
      texto: 'Tuvo pérdidas en 2023 y 2024',
    });
  });
});
