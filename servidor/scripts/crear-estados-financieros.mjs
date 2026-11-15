// Crea en Directus la colección `estados_financieros` (una ficha por
// entidad: el PDF del estado financiero más reciente y su análisis), la
// carpeta "Estados financieros" y el permiso de lectura del "Lector web"
// (solo las fichas publicadas). Se puede correr varias veces: lo que ya
// existe no se toca.
//
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/crear-estados-financieros.mjs
//
// (Detrás de un proxy, con NODE_USE_ENV_PROXY=1.) El token es de un
// administrador; no se guarda en ningún lado.

const D = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const LECTOR_WEB = "ed5bb379-630c-4557-93b9-09d7f72b479d";
if (!TOKEN) throw new Error("Falta DIRECTUS_ADMIN_TOKEN");

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(D + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${texto}`);
  return texto ? JSON.parse(texto).data : null;
}

const existe = async (ruta) =>
  api("GET", ruta).then(
    () => true,
    () => false,
  );

async function carpeta(nombre) {
  const ya = await api(
    "GET",
    `/folders?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: nombre } }))}`,
  );
  if (ya.length) return ya[0].id;
  const nueva = await api("POST", "/folders", { name: nombre });
  console.log(`Carpeta "${nombre}" creada`);
  return nueva.id;
}

const idCarpeta = await carpeta("Estados financieros");

/** Una ficha por entidad: el estado financiero más reciente y su análisis. */
const ESTADOS = {
  collection: "estados_financieros",
  meta: {
    icon: "account_balance",
    note:
      "Estado financiero más reciente de cada entidad (PDF) y su análisis. " +
      "Las cifras (utilidades, patrimonio, cartera) salen solas del CUIF de la " +
      "Superfinanciera: aquí no se escriben.",
    display_template: "{{entidad.nombre}} · {{periodo}} ({{estado}})",
    archive_field: "estado",
    archive_value: "archivado",
    unarchive_value: "borrador",
  },
  schema: {},
  fields: [
    {
      field: "id",
      type: "integer",
      schema: { is_primary_key: true, has_auto_increment: true },
      meta: { hidden: true },
    },
    {
      field: "estado",
      type: "string",
      schema: { default_value: "borrador", is_nullable: false },
      meta: {
        interface: "select-dropdown",
        display: "labels",
        width: "half",
        options: {
          choices: [
            { value: "publicado", text: "Publicado" },
            { value: "borrador", text: "Borrador" },
            { value: "archivado", text: "Archivado" },
          ],
        },
        note: "Solo las publicadas salen en la página",
      },
    },
    {
      field: "entidad",
      type: "string",
      schema: { is_nullable: false, is_unique: true },
      meta: {
        interface: "select-dropdown-m2o",
        special: ["m2o"],
        display: "related-values",
        display_options: { template: "{{nombre}}" },
        options: { template: "{{nombre}}" },
        required: true,
        width: "half",
        note: "Una sola ficha por entidad: cuando salga uno nuevo, se reemplaza",
      },
    },
    {
      field: "periodo",
      type: "string",
      meta: {
        interface: "input",
        required: true,
        width: "half",
        options: { placeholder: "Junio 2026" },
        note: "De qué corte es el PDF (un semestre no es un año completo)",
      },
    },
    {
      field: "pdf",
      type: "uuid",
      meta: {
        interface: "file",
        special: ["file"],
        width: "half",
        options: { folder: idCarpeta },
        note: "El estado financiero en PDF, de la página del banco",
      },
    },
    {
      field: "analisis",
      type: "alias",
      meta: {
        interface: "group-detail",
        special: ["alias", "no-data", "group"],
        options: { start: "open", headerIcon: "insights" },
        note: "Resumen corto: las cifras ya salen solas en la página",
      },
    },
    {
      field: "titular",
      type: "string",
      schema: { max_length: 120 },
      meta: {
        group: "analisis",
        interface: "input",
        options: {
          placeholder: "Ganó 59 % más que el año pasado",
          softLength: 120,
        },
        note: "Una frase (máximo 120 caracteres)",
      },
    },
    {
      field: "puntos",
      type: "json",
      meta: {
        group: "analisis",
        interface: "list",
        special: ["cast-json"],
        options: {
          template: "{{tipo}} · {{texto}}",
          addLabel: "Agregar punto",
          fields: [
            {
              field: "tipo",
              name: "Tipo",
              type: "string",
              meta: {
                field: "tipo",
                type: "string",
                width: "half",
                interface: "select-dropdown",
                required: true,
                options: {
                  choices: [
                    { value: "fortaleza", text: "✓ Fortaleza" },
                    { value: "alerta", text: "⚠ Alerta" },
                  ],
                },
              },
            },
            {
              field: "texto",
              name: "Texto",
              type: "string",
              meta: {
                field: "texto",
                type: "string",
                width: "full",
                interface: "input",
                required: true,
                options: { softLength: 160 },
              },
            },
          ],
        },
        note: "Fortalezas y alertas, cada una en una línea (máximo 160 caracteres)",
      },
    },
    {
      field: "para_ti",
      type: "string",
      schema: { max_length: 200 },
      meta: {
        group: "analisis",
        interface: "input",
        options: {
          placeholder: "Qué significa si vas a pedir un crédito aquí",
          softLength: 200,
        },
        note: '"Qué significa para ti": una frase (máximo 200 caracteres)',
      },
    },
    {
      field: "date_updated",
      type: "timestamp",
      meta: {
        special: ["date-updated"],
        interface: "datetime",
        readonly: true,
        hidden: true,
      },
    },
  ],
};

if (await existe(`/collections/${ESTADOS.collection}`)) {
  console.log("Ya existe la colección estados_financieros");
} else {
  await api("POST", "/collections", ESTADOS);
  console.log("Colección estados_financieros creada");
}

const relaciones = await api("GET", "/relations/estados_financieros");
for (const [campo, relacionada] of [
  ["entidad", "entidades"],
  ["pdf", "directus_files"],
]) {
  if (relaciones.some((r) => r.field === campo)) continue;
  await api("POST", "/relations", {
    collection: "estados_financieros",
    field: campo,
    related_collection: relacionada,
    schema: { on_delete: campo === "entidad" ? "CASCADE" : "SET NULL" },
  });
  console.log(`Relación estados_financieros.${campo} → ${relacionada}`);
}

const ya = await api(
  "GET",
  `/permissions?limit=-1&filter=${encodeURIComponent(
    JSON.stringify({
      policy: { _eq: LECTOR_WEB },
      collection: { _eq: "estados_financieros" },
      action: { _eq: "read" },
    }),
  )}`,
);
if (!ya.length) {
  await api("POST", "/permissions", {
    policy: LECTOR_WEB,
    collection: "estados_financieros",
    action: "read",
    fields: [
      "entidad",
      "periodo",
      "pdf",
      "titular",
      "puntos",
      "para_ti",
      "date_updated",
    ],
    permissions: { estado: { _eq: "publicado" } },
    validation: {},
  });
  console.log("Lector web: read en estados_financieros (solo publicadas)");
}
console.log("Listo.");
