// Crea en Directus la colección `solicitudes_aliados` (formulario "Quiero ser
// aliado") y el permiso del "Lector web" para solo crear. Se puede correr
// varias veces: si ya existe, no la toca.
//
//   DIRECTUS_ADMIN_TOKEN=… node servidor/scripts/crear-solicitudes-aliados.mjs

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

const opciones = (pares) => pares.map(([value, text]) => ({ value, text }));
const lista = (campo, nota) => ({
  field: campo,
  type: "json",
  meta: { interface: "tags", special: ["cast-json"], note: nota },
});
const texto = (campo, nota) => ({
  field: campo,
  type: "string",
  meta: { interface: "input", ...(nota ? { note: nota } : {}) },
});

const COLECCION = {
  collection: "solicitudes_aliados",
  meta: {
    icon: "person_add",
    note: "Asesores que quieren ser aliados (formulario Quiero ser aliado)",
    display_template: "{{nombre}} · {{estado}}",
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
      field: "date_created",
      type: "timestamp",
      meta: {
        special: ["date-created"],
        interface: "datetime",
        readonly: true,
      },
    },
    {
      field: "estado",
      type: "string",
      schema: { default_value: "nueva", is_nullable: false },
      meta: {
        interface: "select-dropdown",
        display: "labels",
        options: {
          choices: opciones([
            ["nueva", "Nueva"],
            ["en_revision", "En revisión"],
            ["aprobada", "Aprobada"],
            ["rechazada", "Rechazada"],
          ]),
        },
      },
    },
    texto("nombre"),
    texto("cedula", "Privado"),
    texto("celular"),
    texto("correo"),
    texto("ciudad", "Ciudad donde vive"),
    {
      field: "tipo",
      type: "string",
      meta: {
        interface: "select-dropdown",
        display: "labels",
        options: {
          choices: opciones([
            ["independiente", "Asesor independiente"],
            ["fuerza_ventas", "Fuerza de ventas"],
            ["empleado_entidad", "Empleado de la entidad"],
            ["empresa", "Empresa asesora"],
          ]),
        },
      },
    },
    texto("empresa"),
    lista("entidades", "Entidades con las que trabaja"),
    lista("productos", "Productos que ofrece"),
    lista("ciudades", "Ciudades donde atiende"),
    {
      field: "experiencia",
      type: "integer",
      meta: { interface: "input", note: "Años de experiencia" },
    },
    {
      field: "vinculo",
      type: "string",
      meta: {
        interface: "select-dropdown",
        display: "labels",
        note: "Cómo puede demostrar su vínculo con las entidades",
        options: {
          choices: opciones([
            ["carta", "Carta de la entidad"],
            ["certificado", "Certificado"],
            ["contrato", "Contrato"],
            ["otro", "Otro"],
          ]),
        },
      },
    },
    { field: "mensaje", type: "text", meta: { interface: "input-multiline" } },
    {
      field: "acepta_reglas",
      type: "boolean",
      meta: {
        interface: "boolean",
        note: "Aceptó las 5 reglas de los aliados",
      },
    },
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

const CAMPOS_CREAR = [
  "nombre",
  "cedula",
  "celular",
  "correo",
  "ciudad",
  "tipo",
  "empresa",
  "entidades",
  "productos",
  "ciudades",
  "experiencia",
  "vinculo",
  "mensaje",
  "acepta_reglas",
  "autorizacion",
];

const existe = await api("GET", "/collections/solicitudes_aliados").then(
  () => true,
  () => false,
);
if (existe) console.log("Ya existe la colección solicitudes_aliados");
else {
  await api("POST", "/collections", COLECCION);
  console.log("Colección solicitudes_aliados creada");
}
const ya = await api(
  "GET",
  `/permissions?limit=-1&filter=${encodeURIComponent(
    JSON.stringify({
      policy: { _eq: LECTOR_WEB },
      collection: { _eq: "solicitudes_aliados" },
    }),
  )}`,
);
if (!ya.length) {
  await api("POST", "/permissions", {
    policy: LECTOR_WEB,
    collection: "solicitudes_aliados",
    action: "create",
    fields: CAMPOS_CREAR,
    permissions: {},
    validation: {},
  });
  console.log("Lector web: create en solicitudes_aliados");
}
console.log("Listo.");
