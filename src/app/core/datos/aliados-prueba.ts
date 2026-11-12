import { signal } from '@angular/core';
import { Aliado } from '../modelos/aliado';

/** Como llega de /api/asesores (colección `asesores` de Directus). */
export const ALEXANDRA: Aliado = {
  id: 'alexandra-rojas-garcia',
  nombre: 'Alexandra Rojas García',
  empresa: 'Fuerza de ventas',
  verificado: true,
  entidades: ['Banco Popular', 'GNB Sudameris', 'BBVA'],
  productos: ['Libranza', 'Préstamos con reportes'],
  ciudades: ['Bogotá', 'Cali', 'Riohacha'],
  foto: '/api/asesores/alexandra-rojas-garcia/foto',
};

export function servicioFalso(lista: Aliado[], sinConexion = false) {
  return {
    aliados: signal(lista),
    cargando: signal(false),
    sinConexion: signal(sinConexion),
    cargar: () => Promise.resolve(),
  };
}
