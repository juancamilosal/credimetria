import { EntidadFinanciera } from '../modelos/financiero';

const MM = 1e9;

/** Solo para las pruebas: Davivienda, enero a agosto de 2026 (CUIF). */
export function entidadDePrueba(
  cambios: Partial<EntidadFinanciera['actual']> = {},
): EntidadFinanciera {
  return {
    codigo: 'davivienda',
    nombre: 'Davivienda',
    tipo: 'Banco',
    logo: null,
    codigoSfc: '1-39',
    fichaTecnica: {
      razonSocial: 'BANCO DAVIVIENDA S.A.',
      nit: '860.034.313-7',
      representante: 'Javier José Suárez Esparragoza',
      cargo: 'Presidente',
      cambioEnCurso: false,
      ciudad: 'Bogotá D.C.',
      direccion: 'Avenida El Dorado No. 68 C - 61',
      sitioWeb: 'https://www.davivienda.com',
    },
    anual: [
      {
        anio: 2023,
        utilidad: 105.9 * MM,
        patrimonio: 13000 * MM,
        cartera: 95000 * MM,
      },
      {
        anio: 2024,
        utilidad: 852.7 * MM,
        patrimonio: 14000 * MM,
        cartera: 100000 * MM,
      },
      {
        anio: 2025,
        utilidad: 1833.5 * MM,
        patrimonio: 15000 * MM,
        cartera: 110000 * MM,
      },
    ],
    actual: {
      corte: '2026-08-31',
      meses: 8,
      utilidad: 1628.9 * MM,
      utilidadAnterior: 1022.4 * MM,
      variacionUtilidad: 0.5932,
      patrimonio: 15662.1 * MM,
      activos: 159974.6 * MM,
      cartera: 116945.3 * MM,
      carteraAnterior: 103820 * MM,
      variacionCartera: 0.1264,
      rentabilidad: 0.156,
      ...cambios,
    },
    analisis: null,
  };
}
