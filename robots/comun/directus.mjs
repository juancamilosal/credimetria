// Cliente mínimo de Directus para los robots, con el token del usuario
// "Robot" (DIRECTUS_TOKEN) y la dirección DIRECTUS_URL (opcional).

const DIRECTUS =
  process.env.DIRECTUS_URL ?? "https://credimetria-api.valkiriacode.com";

export const hayToken = () => Boolean(process.env.DIRECTUS_TOKEN);

/** Pide a Directus y devuelve `data`; lanza un error si no responde bien. */
export async function directus(metodo, ruta, cuerpo) {
  const formulario = cuerpo instanceof FormData;
  const r = await fetch(DIRECTUS + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
      ...(formulario ? {} : { "Content-Type": "application/json" }),
    },
    body: formulario ? cuerpo : cuerpo && JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  if (!r.ok)
    throw new Error(`${metodo} ${ruta} → ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto).data : null;
}

/** Sube un archivo a Directus y devuelve su id. */
export async function subirArchivo(datos, nombre, tipo, titulo) {
  const formulario = new FormData();
  formulario.append("title", titulo);
  formulario.append("file", new Blob([datos], { type: tipo }), nombre);
  return (await directus("POST", "/files", formulario)).id;
}

/** Un archivo guardado en Directus, como Buffer. */
export async function bajarArchivo(id) {
  const r = await fetch(`${DIRECTUS}/assets/${id}`, {
    headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`GET /assets/${id} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
