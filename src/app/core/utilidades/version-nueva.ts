import { NavigationError } from '@angular/router';

/**
 * ¿El error es porque el navegador pidió un archivo de una versión anterior
 * de la página? Pasa cuando publicamos una versión nueva con una pestaña
 * abierta: los archivos de cada página cambian de nombre y los viejos ya no
 * existen (404 al cargar el módulo).
 */
export function esVersionVieja(error: unknown): boolean {
  const texto = String((error as Error)?.message ?? error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    texto,
  );
}

const CLAVE = 'credimetria-recarga';

/**
 * Si la navegación falló por una versión vieja, recarga la página en la
 * dirección a la que iba (así baja la versión nueva). Una sola vez por
 * minuto, para no quedar recargando en bucle si el error es otro.
 */
export function recargarSiVersionVieja(
  evento: NavigationError,
  ventana:
    | Pick<Window, 'location' | 'sessionStorage'>
    | undefined = globalThis.window,
  ahora = Date.now(),
): boolean {
  if (!ventana || !esVersionVieja(evento.error)) return false;
  try {
    const ultima = Number(ventana.sessionStorage.getItem(CLAVE) ?? 0);
    if (ahora - ultima < 60_000) return false;
    ventana.sessionStorage.setItem(CLAVE, String(ahora));
  } catch {
    // Sin sessionStorage (modo privado estricto): igual se recarga.
  }
  ventana.location.assign(evento.url);
  return true;
}
