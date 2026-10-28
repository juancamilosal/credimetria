// Lee al momento un PDF que el administrador carga a mano en /admin/tasas
// (Davivienda, Falabella, la página de Lulo guardada como PDF), con las
// mismas reglas del robot (robots/reglas.mjs y `pdftotext -layout`), y
// devuelve la tasa leída y una copia con la tasa resaltada en verde. No
// escribe nada en Directus: el administrador revisa y guarda.
//
// Solo para administradores de Directus: el navegador manda su token y aquí
// se revisa con Directus que tenga acceso de administrador.

import express from "express";
import { textoPdf } from "../robots/comun/pdf.mjs";
import { resaltarPdf } from "../robots/comun/resaltar.mjs";
import { reglaDe, revisar } from "../robots/reglas.mjs";
import USURA from "../src/app/core/datos/usura.json" with { type: "json" };

const DIRECTUS =
  process.env.DIRECTUS_URL ?? "https://credimetria-api.valkiriacode.com";

/** ¿El token es de un administrador de Directus? */
async function esAdmin(autorizacion) {
  if (!autorizacion?.startsWith("Bearer ")) return false;
  const r = await fetch(
    `${DIRECTUS}/users/me?fields=role.policies.policy.admin_access,policies.policy.admin_access`,
    { headers: { Authorization: autorizacion } },
  );
  if (!r.ok) return false;
  const { data } = await r.json();
  return [...(data?.role?.policies ?? []), ...(data?.policies ?? [])].some(
    (p) => p.policy?.admin_access,
  );
}

/**
 * Lo que leyó la regla, con los campos de `tasas_publicadas`. Como el robot:
 * sin máxima publicada, hasta = usura del mes.
 */
export function tasaLeida(tasa) {
  const sinMaxima = tasa.eaHasta === null;
  return {
    unidad: "MV",
    valor_desde: tasa.mvDesde,
    valor_hasta: sinMaxima ? USURA.mv : tasa.mvHasta,
    ea_desde: tasa.eaDesde,
    ea_hasta: sinMaxima ? USURA.tasa : tasa.eaHasta,
    hasta_origen: sinMaxima ? "usura" : "entidad",
    vigente_desde: tasa.vigencia ?? null,
    frase: tasa.frase ?? null,
    solo_maxima: Boolean(tasa.soloMaxima),
    usura_mes: sinMaxima ? USURA.mes : null,
  };
}

export function rutasLeerPdf(app) {
  // POST /api/admin/leer?banco=davivienda&producto=libranza, con el PDF en
  // el cuerpo (application/pdf).
  app.post(
    "/api/admin/leer",
    express.raw({ type: "application/pdf", limit: "40mb" }),
    async (req, res) => {
      try {
        if (!(await esAdmin(req.headers.authorization)))
          return res.status(401).json({ error: "Solo administradores." });
        const banco = String(req.query.banco ?? "");
        const producto = String(req.query.producto ?? "libre-inversion");
        const regla = reglaDe(banco, producto);
        if (!regla?.leer)
          return res.json({
            leida: false,
            problemas: [`No hay regla para ${banco} en ${producto}.`],
          });
        const datos = Buffer.isBuffer(req.body) ? req.body : null;
        if (!datos || datos.subarray(0, 5).toString() !== "%PDF-")
          return res.status(400).json({ error: "El archivo no es un PDF." });

        let tasa;
        try {
          tasa = regla.leer(await textoPdf(datos));
        } catch (error) {
          return res.json({
            leida: false,
            problemas: [
              error.code === "ENOENT"
                ? "el servidor de la página no tiene pdftotext instalado (poppler-utils)."
                : error.message,
            ],
          });
        }
        const problemas = revisar(tasa, USURA);
        const leida = tasaLeida(tasa);
        const resaltado = await resaltarPdf(datos, {
          cifras: [
            tasa.mvDesde,
            tasa.eaDesde,
            ...(tasa.eaHasta === null ? [] : [tasa.mvHasta, tasa.eaHasta]),
          ],
          vigencia: tasa.vigencia,
          producto,
          ancla: regla.ancla,
        });
        res.json({
          leida: !problemas.length,
          problemas,
          tasa: leida,
          resaltado: resaltado?.toString("base64") ?? null,
        });
      } catch (error) {
        console.error("No se pudo leer el PDF cargado:", error);
        res.status(500).json({ error: "No se pudo leer el PDF." });
      }
    },
  );
}
