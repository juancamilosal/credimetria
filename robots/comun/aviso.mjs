// Correo al administrador cuando un robot necesita a una persona: no
// encontró el PDF, la regla ya no lee el PDF, lo leído no tiene sentido o
// hay una tasa nueva por aprobar.
//
// Variables: SMTP_HOST, SMTP_PUERTO (465 por defecto), SMTP_USUARIO,
// SMTP_CLAVE, AVISO_PARA (a quién) y AVISO_DE (opcional; si no, el usuario).
// Sin SMTP_HOST el aviso solo se escribe en la consola.

const ADMIN = "https://credimetria.valkiriacode.com/admin/tasas";

/**
 * Manda un correo con los puntos de `lineas` (y antes, si llega, `intro`). Nunca lanza error: si el
 * correo falla, lo deja en la consola para verlo en los registros.
 */
export async function avisar(asunto, lineas, intro) {
  const cuerpo = [
    ...(intro ? [intro, ""] : []),
    lineas.map((l) => `• ${l}`).join("\n\n"),
    "",
    `Revisa y aprueba en ${ADMIN}`,
    "",
    "— Robot de Credimetría",
  ].join("\n");
  console.log(`AVISO: ${asunto}\n${cuerpo}`);
  const { SMTP_HOST, SMTP_USUARIO, SMTP_CLAVE, AVISO_PARA } = process.env;
  if (!SMTP_HOST || !AVISO_PARA) return;
  try {
    const { createTransport } = await import("nodemailer");
    const puerto = Number(process.env.SMTP_PUERTO ?? 465);
    await createTransport({
      host: SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: SMTP_USUARIO ? { user: SMTP_USUARIO, pass: SMTP_CLAVE } : undefined,
    }).sendMail({
      from: process.env.AVISO_DE ?? SMTP_USUARIO,
      to: AVISO_PARA,
      subject: `Credimetría · ${asunto}`,
      text: cuerpo,
    });
  } catch (error) {
    console.error("No se pudo mandar el correo:", error.message);
  }
}
