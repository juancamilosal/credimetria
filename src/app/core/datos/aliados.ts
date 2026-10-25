import { Aliado } from '../modelos/aliado';

/*
 * Asesores de ejemplo para ver la pantalla. Antes de publicar el formulario
 * de asesoría esta lista debe venir de la base de datos con los aliados
 * reales y verificados, porque la autorización de datos la nombra.
 */
export const ALIADOS_EJEMPLO: Aliado[] = [
  {
    id: 'ejemplo-1',
    nombre: 'Asesor de ejemplo',
    empresa: 'Fuerza de ventas de ejemplo',
    verificado: true,
    entidades: ['Banco Popular', 'Banco de Occidente'],
    productos: ['Libranza', 'Compra de cartera'],
    ciudades: ['Bogotá', 'Medellín'],
  },
  {
    id: 'ejemplo-2',
    nombre: 'Asesora de ejemplo',
    empresa: 'Asesoría independiente de ejemplo',
    verificado: true,
    entidades: ['AV Villas', 'Bancolombia'],
    productos: ['Libre inversión', 'Vehículo'],
    ciudades: ['Cali', 'Barranquilla'],
  },
];
