/**
 * Comienzo del mes en Colombia (día 1 a la medianoche, UTC−5), en ISO. Las
 * fuentes que se cargan a mano quedan pendientes desde ese momento hasta que
 * alguien las revisa.
 */
export function inicioDelMes(hoy: Date = new Date()): string {
  const colombia = new Date(hoy.getTime() - 5 * 3600_000);
  return new Date(
    Date.UTC(colombia.getUTCFullYear(), colombia.getUTCMonth(), 1, 5),
  ).toISOString();
}

/** La fuente manual no se ha revisado este mes (o nunca). */
export function pendienteDelMes(
  ultimaRevision: string | null | undefined,
  hoy: Date = new Date(),
): boolean {
  return !ultimaRevision || ultimaRevision < inicioDelMes(hoy);
}
