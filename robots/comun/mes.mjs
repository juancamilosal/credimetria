/**
 * La fuente que se carga a mano no se ha revisado este mes (o nunca): queda
 * pendiente desde el día 1 a la medianoche de Colombia (UTC−5). Igual que en
 * el admin (src/app/core/utilidades/mes.ts).
 */
export function pendienteDelMes(ultimaRevision, hoy = new Date()) {
  const colombia = new Date(hoy.getTime() - 5 * 3600_000);
  const inicio = new Date(
    Date.UTC(colombia.getUTCFullYear(), colombia.getUTCMonth(), 1, 5),
  ).toISOString();
  return !ultimaRevision || ultimaRevision < inicio;
}
