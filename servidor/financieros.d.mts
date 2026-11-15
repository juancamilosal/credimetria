import type { DatosFinancieros } from "../src/app/core/modelos/financiero";

export function financieros(): Promise<DatosFinancieros>;
export function pdfEstadoFinanciero(
  codigo: string,
): Promise<{ datos: Buffer; tipo: string } | null>;
export function rutasFinancieros(app: unknown): void;
