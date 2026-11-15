// Guarda en `entidades` de Directus la ficha técnica de cada entidad según
// "Entidades vigiladas por la Superfinanciera" (datos.gov.co sr9n-792w).
//
// - Crea (si no existen) los campos representante_legal, cargo_representante,
//   ciudad, direccion y ficha_actualizada, y deja que el "Lector web" los lea.
// - En cada entidad con `codigo_sfc` llena esos 5 campos. La razón social,
//   el NIT (y su dígito de verificación) y el sitio web solo se llenan si
//   están vacíos: lo que ya hay no se pisa.
// - Crea, INACTIVOS, los bancos que reportan a la Superfinanciera y no están
//   en `entidades` (con su código SFC, su ficha y su logo del repositorio).
//   Inactivos: no salen en el ranking de tasas ni el robot les calcula
//   promedios; la página de estados financieros sí los usa.
//
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/sincronizar-fichas.mjs
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/sincronizar-fichas.mjs --sin-guardar
//
// Se puede correr cada mes. (Detrás de un proxy, con NODE_USE_ENV_PROXY=1.)
// En Windows (PowerShell): $env:DIRECTUS_ADMIN_TOKEN="…"; node servidor/scripts/sincronizar-fichas.mjs

import { readFileSync } from "node:fs";
import { fichaTecnica, LOGOS_SFC, NOMBRES_SFC } from "../financieros.mjs";

const D = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const LECTOR_WEB = "ed5bb379-630c-4557-93b9-09d7f72b479d";
const SIN_GUARDAR = process.argv.includes("--sin-guardar");
const VIGILADAS = "https://www.datos.gov.co/resource/sr9n-792w.json";
if (!TOKEN) throw new Error("Falta DIRECTUS_ADMIN_TOKEN");

async function api(metodo, ruta, cuerpo) {
  if (SIN_GUARDAR && metodo !== "GET") {
    console.log(`  (sin guardar) ${metodo} ${ruta}`);
    return null;
  }
  const r = await fetch(D + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(cuerpo && !(cuerpo instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      cuerpo instanceof FormData
        ? cuerpo
        : cuerpo
          ? JSON.stringify(cuerpo)
          : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${texto}`);
  return texto ? JSON.parse(texto).data : null;
}

/** Los 5 campos nuevos de la ficha. */
const CAMPOS = [
  {
    field: "representante_legal",
    type: "string",
    meta: {
      interface: "input",
      width: "half",
      note: "Presidente o representante legal (Superfinanciera)",
    },
  },
  {
    field: "cargo_representante",
    type: "string",
    meta: {
      interface: "input",
      width: "half",
      note: "Presidente, Presidente Ejecutivo, Gerente General…",
    },
  },
  {
    field: "ciudad",
    type: "string",
    meta: { interface: "input", width: "half", note: "Sede principal" },
  },
  {
    field: "direccion",
    type: "string",
    meta: { interface: "input", width: "half", note: "Sede principal" },
  },
  {
    field: "ficha_actualizada",
    type: "date",
    meta: {
      interface: "datetime",
      width: "half",
      note: "Cuándo se trajo la ficha de la Superfinanciera (sincronizar-fichas.mjs)",
    },
  },
];

// 1. Campos nuevos.
const campos = await api("GET", "/fields/entidades");
const existentes = new Set(campos.map((c) => c.field));
for (const c of CAMPOS) {
  if (existentes.has(c.field)) continue;
  await api("POST", "/fields/entidades", c);
  console.log(`Campo entidades.${c.field} creado`);
}
/** El primer campo que exista de la lista (los nombres no se conocen). */
const campo = (...nombres) => nombres.find((n) => existentes.has(n)) ?? null;
const RAZON = campo("razon_social");
const NIT = campo("nit");
const DV = campo("dv", "digito_verificacion", "digito");
const WEB = campo("sitio_web", "sitio", "web", "url", "pagina_web");
console.log(
  `Campos que ya existen: razón social=${RAZON}, NIT=${NIT}, DV=${DV}, sitio web=${WEB}`,
);

// 2. El "Lector web" lee los campos nuevos.
const [lectura] = await api(
  "GET",
  `/permissions?limit=-1&filter=${encodeURIComponent(
    JSON.stringify({
      policy: { _eq: LECTOR_WEB },
      collection: { _eq: "entidades" },
      action: { _eq: "read" },
    }),
  )}`,
);
if (lectura && !(lectura.fields ?? []).includes("*")) {
  const faltan = CAMPOS.map((c) => c.field).filter(
    (f) => !(lectura.fields ?? []).includes(f),
  );
  if (faltan.length) {
    await api("PATCH", `/permissions/${lectura.id}`, {
      fields: [...(lectura.fields ?? []), ...faltan],
    });
    console.log(`Lector web: ahora lee ${faltan.join(", ")}`);
  }
} else if (!lectura) {
  console.log('Ojo: el "Lector web" no tiene lectura en entidades.');
}

// 3. Fichas de la Superfinanciera.
const r = await fetch(
  `${VIGILADAS}?${new URLSearchParams({ $limit: "5000" })}`,
  { signal: AbortSignal.timeout(60_000) },
);
if (!r.ok) throw new Error(`Superfinanciera ${r.status}`);
const filas = new Map(
  (await r.json()).map((f) => [`${f.tipo_entidad}-${f.cod_entidad}`, f]),
);
const hoy = new Date().toISOString().slice(0, 10);

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";
const soloNumeros = (v) => String(v ?? "").replace(/\D/g, "");

/** Los cambios para una entidad (los vacíos se llenan; la ficha se renueva). */
function cambios(actual, fila) {
  const f = fichaTecnica(fila);
  const c = {
    representante_legal: f.representante,
    cargo_representante: f.cargo,
    ciudad: f.ciudad,
    direccion: f.direccion,
    ficha_actualizada: hoy,
  };
  const numero = soloNumeros(fila.numeroidentificacion);
  if (RAZON && vacio(actual?.[RAZON]) && f.razonSocial)
    c[RAZON] = f.razonSocial;
  if (NIT && vacio(actual?.[NIT]) && numero.length > 1)
    c[NIT] = DV ? numero.slice(0, -1) : numero;
  if (DV && vacio(actual?.[DV]) && numero.length > 1) c[DV] = numero.slice(-1);
  if (WEB && vacio(actual?.[WEB]) && f.sitioWeb) c[WEB] = f.sitioWeb;
  return c;
}

const leer = ["codigo", "nombre", "codigo_sfc", RAZON, NIT, DV, WEB].filter(
  Boolean,
);
const entidades = await api(
  "GET",
  `/items/entidades?limit=-1&fields=${leer.join(",")}`,
);
let actualizadas = 0;
const conCodigo = new Set();
for (const e of entidades) {
  const clave = e.codigo_sfc?.trim();
  if (!clave) continue;
  conCodigo.add(clave);
  const fila = filas.get(clave);
  if (!fila) {
    console.log(`  ${e.nombre} (${clave}): no está en la Superfinanciera`);
    continue;
  }
  await api(
    "PATCH",
    `/items/entidades/${encodeURIComponent(e.codigo)}`,
    cambios(e, fila),
  );
  actualizadas++;
}
console.log(`Fichas actualizadas: ${actualizadas}`);

// 4. Bancos que faltan, inactivos.
const slug = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const codigos = new Set(entidades.map((e) => e.codigo));
let idCarpeta = null;
for (const [clave, nombre] of Object.entries(NOMBRES_SFC)) {
  if (conCodigo.has(clave)) continue;
  const fila = filas.get(clave);
  if (!fila) continue;
  let codigo = slug(nombre);
  if (codigos.has(codigo)) codigo = `${codigo}-sfc`;
  const nueva = {
    codigo,
    nombre,
    codigo_sfc: clave,
    tipo: "Banco",
    activa: false,
    ...cambios(null, fila),
  };
  const ruta = LOGOS_SFC[clave];
  if (ruta && !SIN_GUARDAR) {
    if (!idCarpeta) {
      const ya = await api(
        "GET",
        `/folders?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: "Logos" } }))}`,
      );
      idCarpeta = ya[0]?.id ?? null;
    }
    const datos = new FormData();
    if (idCarpeta) datos.append("folder", idCarpeta);
    datos.append("title", `Logo ${nombre}`);
    datos.append(
      "file",
      new Blob(
        [readFileSync(new URL(`../../public${ruta}`, import.meta.url))],
        { type: "image/webp" },
      ),
      ruta.split("/").pop(),
    );
    nueva.logo = (await api("POST", "/files", datos)).id;
  }
  await api("POST", "/items/entidades", nueva);
  console.log(`Creada (inactiva): ${nombre} (${clave}) como "${codigo}"`);
}
console.log(SIN_GUARDAR ? "Listo (no se guardó nada)." : "Listo.");
