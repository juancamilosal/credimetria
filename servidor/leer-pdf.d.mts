export function rutasLeerPdf(app: {
  post(ruta: string, ...manejadores: ((...args: any[]) => unknown)[]): unknown;
}): void;
