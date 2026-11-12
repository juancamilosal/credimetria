// Crea en Directus las colecciones `asesores` y `reportes_asesores`, sus
// relaciones, los permisos del "Lector web" y carga a la primera aliada.
// Se puede correr varias veces: lo que ya existe no se toca.
//
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/crear-asesores.mjs
//
// (Detrás de un proxy, con NODE_USE_ENV_PROXY=1.) El token es de un
// administrador; no se guarda en ningún lado.

import { readFileSync } from "node:fs";

const D = process.env.DIRECTUS_URL ?? "https://api.credimetria.com";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const LECTOR_WEB = "ed5bb379-630c-4557-93b9-09d7f72b479d";
if (!TOKEN) throw new Error("Falta DIRECTUS_ADMIN_TOKEN");

async function api(metodo, ruta, cuerpo) {
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

const existe = async (ruta) =>
  api("GET", ruta).then(
    () => true,
    () => false,
  );

const lista = (campo, nota) => ({
  field: campo,
  type: "json",
  meta: { interface: "tags", special: ["cast-json"], note: nota },
});

const opciones = (pares) => pares.map(([value, text]) => ({ value, text }));

const fechas = [
  {
    field: "date_created",
    type: "timestamp",
    meta: { special: ["date-created"], interface: "datetime", readonly: true },
  },
  {
    field: "date_updated",
    type: "timestamp",
    meta: { special: ["date-updated"], interface: "datetime", readonly: true },
  },
];

/** Asesores aliados: lo público sale en /aliados; lo privado no. */
const ASESORES = {
  collection: "asesores",
  meta: {
    icon: "badge",
    note: "Asesores aliados publicados en credimetria.com/aliados",
    sort_field: "orden",
    display_template: "{{nombre}} ({{estado}})",
    archive_field: "estado",
    archive_value: "retirado",
    unarchive_value: "borrador",
  },
  schema: {},
  fields: [
    {
      field: "id",
      type: "string",
      schema: { is_primary_key: true, length: 80 },
      meta: {
        interface: "input",
        note: "Identificador en la página, por ejemplo alexandra-rojas-garcia",
      },
    },
    {
      field: "estado",
      type: "string",
      schema: { default_value: "borrador", is_nullable: false },
      meta: {
        interface: "select-dropdown",
        display: "labels",
        options: {
          choices: opciones([
            ["publicado", "Publicado"],
            ["borrador", "Borrador"],
            ["retirado", "Retirado"],
          ]),
        },
        note: "Solo los publicados salen en la página y reciben solicitudes",
      },
    },
    {
      field: "orden",
      type: "integer",
      meta: { interface: "input", hidden: true },
    },
    {
      field: "nombre",
      type: "string",
      schema: { is_nullable: false },
      meta: { interface: "input", required: true },
    },
    {
      field: "empresa",
      type: "string",
      meta: { interface: "input", note: "Por ejemplo, Fuerza de ventas" },
    },
    {
      field: "verificado",
      type: "boolean",
      schema: { default_value: false },
      meta: {
        interface: "boolean",
        note: "Mostró su vínculo con las entidades (carta o certificado)",
      },
    },
    lista("entidades", "Entidades con las que trabaja"),
    lista("productos", "Productos que ofrece"),
    lista("ciudades", "Ciudades donde atiende"),
    {
      field: "foto",
      type: "uuid",
      meta: {
        interface: "file-image",
        special: ["file"],
        note: "Solo con su autorización para publicarla",
      },
    },
    {
      field: "cedula",
      type: "string",
      meta: { interface: "input", note: "Privado: no sale en la página" },
    },
    {
      field: "celular",
      type: "string",
      meta: { interface: "input", note: "Privado: no sale en la página" },
    },
    {
      field: "correo",
      type: "string",
      meta: { interface: "input", note: "Privado: no sale en la página" },
    },
    { field: "fecha_ingreso", type: "date", meta: { interface: "datetime" } },
    {
      field: "notas",
      type: "text",
      meta: { interface: "input-multiline", note: "Privado" },
    },
    ...fechas,
  ],
};

const MOTIVOS = [
  ["cobro_adelantado", "Me pidió dinero por adelantado"],
  ["datos", "Usó o compartió mis datos sin permiso"],
  ["horario_canal", "Me contactó fuera de horario o por otro canal"],
  ["suplantacion", "Se hizo pasar por el banco o por Credimetría"],
  ["trato", "Mal trato o información falsa"],
  ["otro", "Otro"],
];

/** Reportes contra asesores que llegan desde /aliados/reportar. */
const REPORTES = {
  collection: "reportes_asesores",
  meta: {
    icon: "report",
    note: "Reportes de personas contra asesores aliados",
    display_template: "{{motivo}} · {{asesor.nombre}}{{asesor_nombre}}",
  },
  schema: {},
  fields: [
    {
      field: "id",
      type: "integer",
      schema: { is_primary_key: true, has_auto_increment: true },
      meta: { hidden: true },
    },
    fechas[0],
    {
      field: "estado",
      type: "string",
      schema: { default_value: "nuevo", is_nullable: false },
      meta: {
        interface: "select-dropdown",
        display: "labels",
        options: {
          choices: opciones([
            ["nuevo", "Nuevo"],
            ["en_revision", "En revisión"],
            ["resuelto", "Resuelto"],
            ["descartado", "Descartado"],
          ]),
        },
      },
    },
    {
      field: "asesor",
      type: "string",
      meta: {
        interface: "select-dropdown-m2o",
        special: ["m2o"],
        display: "related-values",
        display_options: { template: "{{nombre}}" },
      },
    },
    {
      field: "asesor_nombre",
      type: "string",
      meta: {
        interface: "input",
        note: "Si el asesor no está en la lista, el nombre que escribió",
      },
    },
    {
      field: "motivo",
      type: "string",
      meta: {
        interface: "select-dropdown",
        display: "labels",
        options: { choices: opciones(MOTIVOS) },
      },
    },
    {
      field: "descripcion",
      type: "text",
      meta: { interface: "input-multiline" },
    },
    { field: "fecha_contacto", type: "date", meta: { interface: "datetime" } },
    { field: "nombre", type: "string", meta: { interface: "input" } },
    { field: "correo", type: "string", meta: { interface: "input" } },
    { field: "celular", type: "string", meta: { interface: "input" } },
    {
      field: "autorizacion",
      type: "json",
      meta: {
        interface: "input-code",
        special: ["cast-json"],
        note: "Prueba de la autorización (Ley 1581): fecha, texto, versión, página e IP",
      },
    },
    {
      field: "notas",
      type: "text",
      meta: { interface: "input-multiline", note: "Notas internas" },
    },
  ],
};

const CAMPOS_PUBLICOS = [
  "id",
  "nombre",
  "empresa",
  "verificado",
  "entidades",
  "productos",
  "ciudades",
  "foto",
  "orden",
];
const CAMPOS_REPORTE = [
  "asesor",
  "asesor_nombre",
  "motivo",
  "descripcion",
  "fecha_contacto",
  "nombre",
  "correo",
  "celular",
  "autorizacion",
];

async function crearColeccion(def) {
  if (await existe(`/collections/${def.collection}`)) {
    console.log(`Ya existe la colección ${def.collection}`);
    return;
  }
  await api("POST", "/collections", def);
  console.log(`Colección ${def.collection} creada`);
}

async function crearRelacion(coleccion, campo, relacionada) {
  const ya = await api("GET", `/relations/${coleccion}`).then((rs) =>
    rs.some((r) => r.field === campo),
  );
  if (ya) return;
  await api("POST", "/relations", {
    collection: coleccion,
    field: campo,
    related_collection: relacionada,
    schema: { on_delete: "SET NULL" },
  });
  console.log(`Relación ${coleccion}.${campo} → ${relacionada}`);
}

async function permiso(coleccion, accion, campos, filtro = {}) {
  const ya = await api(
    "GET",
    `/permissions?limit=-1&filter=${encodeURIComponent(
      JSON.stringify({
        policy: { _eq: LECTOR_WEB },
        collection: { _eq: coleccion },
        action: { _eq: accion },
      }),
    )}`,
  );
  if (ya.length) return;
  await api("POST", "/permissions", {
    policy: LECTOR_WEB,
    collection: coleccion,
    action: accion,
    fields: campos,
    permissions: filtro,
    validation: {},
  });
  console.log(`Lector web: ${accion} en ${coleccion}`);
}

async function carpeta(nombre) {
  const ya = await api(
    "GET",
    `/folders?filter=${encodeURIComponent(JSON.stringify({ name: { _eq: nombre } }))}`,
  );
  if (ya.length) return ya[0].id;
  return (await api("POST", "/folders", { name: nombre })).id;
}

async function cargarAlexandra() {
  if (await existe("/items/asesores/alexandra-rojas-garcia")) {
    console.log("Alexandra ya está cargada");
    return;
  }
  const idCarpeta = await carpeta("Asesores");
  const datos = new FormData();
  datos.append("folder", idCarpeta);
  datos.append("title", "Alexandra Rojas García");
  datos.append(
    "file",
    new Blob(
      [readFileSync(new URL("./alexandra-rojas-garcia.webp", import.meta.url))],
      {
        type: "image/webp",
      },
    ),
    "alexandra-rojas-garcia.webp",
  );
  const archivo = await api("POST", "/files", datos);
  await api("POST", "/items/asesores", {
    id: "alexandra-rojas-garcia",
    estado: "publicado",
    orden: 1,
    nombre: "Alexandra Rojas García",
    empresa: "Fuerza de ventas",
    verificado: true,
    entidades: [
      "Banco Popular",
      "GNB Sudameris",
      "BBVA",
      "AV Villas",
      "Banco de Bogotá",
      "Banco Pichincha",
    ],
    productos: [
      "Libranza",
      "Consumo",
      "Tarjeta de crédito",
      "Hipotecario",
      "Préstamos con reportes",
    ],
    ciudades: [
      "Bogotá",
      "Medellín",
      "Cali",
      "Armenia",
      "Pereira",
      "Montería",
      "Cúcuta",
      "Villavicencio",
      "Ibagué",
      "Bucaramanga",
      "Cartagena",
      "Santa Marta",
      "Barranquilla",
      "Sincelejo",
      "Riohacha",
      "Yopal",
      "Pasto",
      "Manizales",
      "Girardot",
      "Sogamoso",
      "Neiva",
      "Valledupar",
      "Tunja",
    ],
    foto: archivo.id,
    fecha_ingreso: "2026-11-11",
  });
  console.log("Alexandra Rojas García cargada (publicada, con foto)");
}

await crearColeccion(ASESORES);
await crearColeccion(REPORTES);
await crearRelacion("asesores", "foto", "directus_files");
await crearRelacion("reportes_asesores", "asesor", "asesores");
await permiso("asesores", "read", CAMPOS_PUBLICOS, {
  estado: { _eq: "publicado" },
});
await permiso("reportes_asesores", "create", CAMPOS_REPORTE);
await cargarAlexandra();
console.log("Listo.");
