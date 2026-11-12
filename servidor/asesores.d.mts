import type { Aliado } from "../src/app/core/modelos/aliado";

export function asesoresPublicos(): Promise<Aliado[]>;

export function rutasAsesores(
  app: {
    get(ruta: string, ...manejadores: ((...args: any[]) => unknown)[]): unknown;
    post(
      ruta: string,
      ...manejadores: ((...args: any[]) => unknown)[]
    ): unknown;
  },
  opciones?: {
    leerAsesores?: () => Promise<Aliado[]>;
    foto?: (id: string) => Promise<{ datos: Buffer; tipo: string } | null>;
    guardar?: (reporte: object) => Promise<void>;
    mandar?: (correo: object) => Promise<void>;
    verificar?: (token: unknown, ip: string | null) => Promise<boolean>;
  },
): void;

export function rutasSolicitudesAliados(
  app: {
    post(
      ruta: string,
      ...manejadores: ((...args: any[]) => unknown)[]
    ): unknown;
  },
  opciones?: {
    guardar?: (solicitud: object) => Promise<void>;
    mandar?: (correo: object) => Promise<void>;
    verificar?: (token: unknown, ip: string | null) => Promise<boolean>;
  },
): void;
