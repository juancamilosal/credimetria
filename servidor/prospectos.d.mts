export function rutasProspectos(
  app: {
    post(
      ruta: string,
      ...manejadores: ((...args: any[]) => unknown)[]
    ): unknown;
  },
  opciones?: {
    guardar?: (prospecto: object) => Promise<void>;
    mandar?: (correo: object) => Promise<void>;
  },
): void;
