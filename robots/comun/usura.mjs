// La usura del mes para los robots: la de Directus (colección `usura`, la
// cambia el admin en "Máximo de usura") y, si no responde o el usuario Robot
// no la puede leer, la de `src/app/core/datos/usura.json`.
import { readFile } from "node:fs/promises";
import { directus, hayToken } from "./directus.mjs";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** { tasa: 28.34, mv: 2.1, mes: "noviembre de 2026" } de la fila de Directus. */
export function usuraDe(fila) {
  const tasa = Number(fila?.tasa_ea);
  const [anio, mes] = String(fila?.mes ?? "")
    .split("-")
    .map(Number);
  if (!Number.isFinite(tasa) || tasa <= 0 || !anio || !mes) return null;
  return {
    tasa,
    mv: +((Math.pow(1 + tasa / 100, 1 / 12) - 1) * 100).toFixed(2),
    mes: `${MESES[mes - 1]} de ${anio}`,
  };
}

export async function leerUsura() {
  if (hayToken()) {
    try {
      const usura = usuraDe(
        await directus("GET", "/items/usura?fields=tasa_ea,mes"),
      );
      if (usura) return usura;
    } catch (error) {
      console.warn(
        `No pude leer la usura de Directus (${error.message}); uso usura.json.`,
      );
    }
  }
  return JSON.parse(
    await readFile(
      new URL("../../src/app/core/datos/usura.json", import.meta.url),
      "utf8",
    ),
  );
}
