/**
 * Entidades que prestan a personas reportadas en centrales de riesgo, para la
 * página /si-tienes-reportes. No se muestran tasas (decisión del 12 nov 2026):
 * solo el registro oficial, la especialidad y que los asesores aliados pueden
 * gestionar la solicitud.
 *
 * Nivel 1: vigiladas por la Superintendencia Financiera.
 * Nivel 2: operadoras de libranza inscritas en el RUNEOL (Cámaras de Comercio),
 * supervisadas por la Superintendencia de Sociedades.
 *
 * Registros consultados el 12 nov 2026 en runeol.rues.org.co y en los datos de
 * la Superfinanciera (datos.gov.co, conjunto qzsc-9esp). Se renuevan cada año
 * entre enero y marzo: revisar de nuevo en abril.
 *
 * `logo`: archivo en public/logos-entidades/. Sin logo, la tarjeta muestra las
 * iniciales.
 */

export type NivelEntidad = 1 | 2;

/** Para el filtro de especialidad. */
export type Especialidad = 'pensionados' | 'empleados' | 'reportados';

export interface DatoRegistro {
  etiqueta: string;
  valor: string;
}

export interface EntidadReportados {
  id: string;
  nombre: string;
  nivel: NivelEntidad;
  tipo: string;
  iniciales: string;
  logo?: string;
  /** Lo que se muestra como etiquetas en la tarjeta. */
  especialidades: string[];
  filtros: Especialidad[];
  nota?: string;
  /** Algo del registro que falta confirmar con la entidad. */
  porConfirmar?: string;
  registro: DatoRegistro[];
}

export const FECHA_CONSULTA_REGISTROS = '12 nov 2026';

export const ENLACE_RUNEOL = 'https://runeol.rues.org.co/';
export const ENLACE_SUPERFINANCIERA =
  'https://www.superfinanciera.gov.co/publicaciones/10106613/';

export const ENTIDADES_REPORTADOS: EntidadReportados[] = [
  {
    id: 'koa',
    nombre: 'Koa',
    nivel: 1,
    tipo: 'Compañía de financiamiento',
    iniciales: 'KO',
    logo: '/logos-entidades/koa.webp',
    especialidades: ['Libranza'],
    filtros: [],
    registro: [
      {
        etiqueta: 'Razón social',
        valor: 'KOA COMPAÑIA DE FINANCIAMIENTO S.A',
      },
      { etiqueta: 'NIT', valor: '901779951' },
      {
        etiqueta: 'Supervisor',
        valor: 'Superintendencia Financiera (código de entidad 129)',
      },
      {
        etiqueta: 'También en el RUNEOL',
        valor: '90177995100007923 · renovó 2026',
      },
      { etiqueta: 'Sanciones en el RUNEOL', valor: '0' },
      { etiqueta: 'Consultado', valor: FECHA_CONSULTA_REGISTROS },
    ],
  },
  {
    id: 'vantage',
    nombre: 'Vantage',
    nivel: 2,
    tipo: 'Operadora de libranza',
    iniciales: 'VA',
    especialidades: [
      'Libranza por convenio con tu empresa',
      'Atiende reportados',
    ],
    filtros: ['empleados', 'reportados'],
    nota: 'Según su sitio, su oferta es "ideal para personas que están reportadas negativamente en centrales de riesgo".',
    registro: [
      { etiqueta: 'Razón social', valor: 'VANTAGE THE FINANCE PRACTICE S A S' },
      { etiqueta: 'NIT', valor: '900690783' },
      { etiqueta: 'N.º de reconocimiento', valor: '90069078300007920' },
      { etiqueta: 'Cámara de Comercio', valor: 'Bogotá' },
      { etiqueta: 'Renovación', valor: '2026' },
      { etiqueta: 'Sanciones', valor: '0' },
      {
        etiqueta: 'Vehículos inscritos',
        valor:
          'Patrimonio Autónomo Vantage (901556640) y Fideicomiso Master Trust Vantage Onest (901619143)',
      },
      { etiqueta: 'Consultado', valor: FECHA_CONSULTA_REGISTROS },
    ],
  },
  {
    id: 'mission',
    nombre: 'Mission',
    nivel: 2,
    tipo: 'Operadora de libranza',
    iniciales: 'MI',
    especialidades: ['Libranza'],
    filtros: [],
    registro: [
      { etiqueta: 'Razón social', valor: 'MISSION SAS' },
      { etiqueta: 'NIT', valor: '900698231' },
      { etiqueta: 'N.º de reconocimiento', valor: '90069823100000222' },
      { etiqueta: 'Cámara de Comercio', valor: 'Bogotá' },
      { etiqueta: 'Renovación', valor: '2026' },
      { etiqueta: 'Sanciones', valor: '0' },
      {
        etiqueta: 'Vehículo inscrito',
        valor: 'Fideicomiso Mission (830053036)',
      },
      { etiqueta: 'Consultado', valor: FECHA_CONSULTA_REGISTROS },
    ],
  },
  {
    id: 'kala',
    nombre: 'Kala',
    nivel: 2,
    tipo: 'Operadora de libranza',
    iniciales: 'KA',
    especialidades: ['Libranza para pensionados'],
    filtros: ['pensionados'],
    registro: [
      { etiqueta: 'Razón social', valor: 'KALA COLOMBIA SAS' },
      { etiqueta: 'NIT', valor: '901541749' },
      { etiqueta: 'N.º de reconocimiento', valor: '90154174900007914' },
      { etiqueta: 'Cámara de Comercio', valor: 'Bogotá' },
      { etiqueta: 'Renovación', valor: '2026' },
      { etiqueta: 'Sanciones', valor: '0' },
      {
        etiqueta: 'Vehículo inscrito',
        valor: 'Fideicomiso Master Trust Kala (901796987)',
      },
      { etiqueta: 'Consultado', valor: FECHA_CONSULTA_REGISTROS },
    ],
  },
  {
    id: 'biv',
    nombre: 'BIV',
    nivel: 2,
    tipo: 'Operadora de libranza',
    iniciales: 'BI',
    especialidades: [
      'Préstamos en línea para pensionados',
      'De $1 a $150 millones',
    ],
    filtros: ['pensionados'],
    porConfirmar:
      'El registro está a nombre de Patrimonio Autónomo Marsof BIV. Falta confirmar con la entidad que corresponde a biv.com.co.',
    registro: [
      { etiqueta: 'Razón social', valor: 'PATRIMONIO AUTÓNOMO MARSOF BIV' },
      { etiqueta: 'NIT', valor: '901867598' },
      { etiqueta: 'N.º de reconocimiento', valor: '90186759800008433' },
      { etiqueta: 'Cámara de Comercio', valor: 'Cali' },
      { etiqueta: 'Renovación', valor: '2026' },
      { etiqueta: 'Sanciones', valor: '0' },
      { etiqueta: 'Consultado', valor: FECHA_CONSULTA_REGISTROS },
    ],
  },
];
