import { Aliado } from '../modelos/aliado';

/*
 * Asesores aliados publicados en /aliados: las únicas personas que pueden
 * recibir los datos de quien pide asesoría (la autorización los nombra).
 * Solo se agregan con su autorización para publicar nombre y foto, y con
 * "verificado" cuando mostraron su vínculo con las entidades (carta o
 * certificado).
 */
export const ALIADOS: Aliado[] = [
  {
    // Primera aliada (11 nov 2026).
    id: 'alexandra-rojas-garcia',
    nombre: 'Alexandra Rojas García',
    empresa: 'Fuerza de ventas',
    verificado: true,
    entidades: [
      'Banco Popular',
      'GNB Sudameris',
      'BBVA',
      'AV Villas',
      'Banco de Bogotá',
      'Banco Pichincha',
    ],
    productos: [
      'Libranza',
      'Consumo',
      'Tarjeta de crédito',
      'Hipotecario',
      'Préstamos con reportes',
    ],
    // 23 ciudades (12 nov 2026).
    ciudades: [
      'Bogotá',
      'Medellín',
      'Cali',
      'Armenia',
      'Pereira',
      'Montería',
      'Cúcuta',
      'Villavicencio',
      'Ibagué',
      'Bucaramanga',
      'Cartagena',
      'Santa Marta',
      'Barranquilla',
      'Sincelejo',
      'Riohacha',
      'Yopal',
      'Pasto',
      'Manizales',
      'Girardot',
      'Sogamoso',
      'Neiva',
      'Valledupar',
      'Tunja',
    ],
    foto: '/aliados/alexandra-rojas-garcia.webp',
  },
];
