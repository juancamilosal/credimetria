import type { CorteTasas, TasaEntidad } from "../src/app/core/modelos/tasa";

export interface Usura {
  tasa: number;
  mv: number;
  mes: string;
}

export interface TasasPublicas {
  corte: CorteTasas;
  tasas: TasaEntidad[];
  usura: Usura;
}

export function usuraDe(fila: unknown): Usura;

export function tasasPublicas(): Promise<TasasPublicas>;
export function logoEntidad(
  codigo: string,
): Promise<{ datos: Buffer; tipo: string; en: number } | null>;
export function rutasTasas(app: {
  get(ruta: string, manejador: (req: any, res: any) => unknown): unknown;
}): void;
