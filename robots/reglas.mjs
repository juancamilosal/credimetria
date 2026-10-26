// Reglas por banco del robot de los PDF: dónde está el PDF de tasas y cómo
// leer de su texto (pdftotext -layout) la tasa de libre inversión.
//
// Cada regla tiene:
//   bloquea: true si el banco rechaza descargas desde servidores (403 aun con
//     navegador). Se sigue intentando, pero el aviso llega solo los lunes:
//     ese PDF se revisa y se sube a mano en /admin/tasas.
//   buscar(fuente, hoy) → direcciones posibles del PDF, la más nueva primero.
//     Por defecto la de la fuente; `enlace` la busca en la página índice.
//   leer(texto) → { mvDesde, eaDesde, mvHasta, eaHasta, vigencia, frase }.
//     Hasta en null si el banco no publica máxima (el robot pone la usura).
//     Si el PDF cambió de forma y no encuentra los datos, lanza un error que
//     le llega por correo al administrador.

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

/** "23,47" o "1.30" → 23.47 */
export const numero = (texto) => Number(texto.replace(",", "."));

/** Texto sin espacios repetidos, para buscar con expresiones sencillas. */
const plano = (texto) => texto.replace(/[ \t]+/g, " ");

/** "1 de Octubre de 2026", "Octubre 05 de 2026" u "octubre de 2026" → AAAA-MM-DD. */
export function fecha(texto) {
  const t = texto.toLowerCase();
  let m = t.match(/(\d{1,2}) de (\p{L}+) (?:de )?(\d{4})/u);
  if (m && MESES.includes(m[2])) return iso(m[3], m[2], m[1]);
  m = t.match(/(\p{L}+) (\d{1,2}) de (\d{4})/u);
  if (m && MESES.includes(m[1])) return iso(m[3], m[1], m[2]);
  m = t.match(/(\p{L}+) de (\d{4})/u);
  if (m && MESES.includes(m[1])) return iso(m[2], m[1], 1);
  return null;
}

const iso = (año, mes, dia) =>
  `${año}-${String(MESES.indexOf(mes) + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

class ReglaRota extends Error {}

/** Busca `patron` en `texto` o avisa que la regla ya no sirve. */
function exigir(texto, patron, queBusca) {
  const m = texto.match(patron);
  if (!m) throw new ReglaRota(`No encontré ${queBusca} en el PDF.`);
  return m;
}

/** Desde el primer `ancla` hasta el final (o error si no está). */
function despuesDe(texto, ancla, queBusca) {
  const i = texto.search(ancla);
  if (i < 0) throw new ReglaRota(`No encontré ${queBusca} en el PDF.`);
  return texto.slice(i);
}

export const REGLAS = {
  bbva: {
    // Dirección fija; cambia el contenido.
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /Vigencia: A partir de ([^\n]+)/, "la vigencia");
      const bloque = despuesDe(
        t,
        /Libre Inversión\n/,
        'la tabla "Libre Inversión"',
      );
      const m = exigir(
        bloque,
        /Todos ([\d,]+)% ([\d,]+)% ([\d,]+)% ([\d,]+)%/,
        'la fila "Todos" de libre inversión',
      );
      return {
        eaDesde: numero(m[1]),
        mvDesde: numero(m[2]),
        eaHasta: numero(m[3]),
        mvHasta: numero(m[4]),
        vigencia: fecha(vig[1]),
        frase: m[0],
      };
    },
  },

  "banco-de-bogota": {
    // Un PDF por mes: /documents/d/guest/tasas-<mes>-<año>.
    buscar(fuente, hoy) {
      const mes = MESES[hoy.getMonth()];
      const nuevo = `https://www.bancodebogota.com/documents/d/guest/tasas-${mes}-${hoy.getFullYear()}`;
      return [nuevo, fuente.url].filter((u, i, l) => u && l.indexOf(u) === i);
    },
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /Vigentes desde ([^\n]+)/, "la vigencia");
      const filas = [
        ...t.matchAll(
          /Libre Destino[^\n]*\(Desde\)[^\n]*?([\d.,]+)% ([\d.,]+)%/g,
        ),
      ];
      if (!filas.length)
        throw new ReglaRota(
          'No encontré las filas "Crédito de Consumo Libre Destino (Desde)" en el PDF.',
        );
      // El "desde" es la tasa más baja de todos los segmentos.
      const menor = filas.reduce((a, b) =>
        numero(b[2]) < numero(a[2]) ? b : a,
      );
      return {
        mvDesde: numero(menor[1]),
        eaDesde: numero(menor[2]),
        mvHasta: null,
        eaHasta: null,
        vigencia: fecha(vig[1]),
        frase: menor[0].trim(),
      };
    },
  },

  bancolombia: {
    // La dirección cambia cada mes: se busca en el tarifario (url_indice).
    enlace: /[^"'\s<>]*Actualizacion_tasas_[^"'\s<>]*\.pdf[^"'\s<>]*/gi,
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(
        t,
        /vigentes a partir del ([^,\n]+), para\s*\n?\s*los créditos de Libre Inversión/,
        "la vigencia de libre inversión",
      );
      const bloque = despuesDe(
        t,
        /los créditos de Libre Inversión/,
        'el texto "los créditos de Libre Inversión"',
      );
      const mv = exigir(
        bloque,
        /([\d.,]+)% Mes Vencida ([\d.,]+)% Mes Vencida/,
        "las tasas mes vencida de libre inversión",
      );
      const ea = exigir(
        bloque,
        /([\d.,]+)% Efectiva Anual ([\d.,]+)% Efectiva Anual/,
        "las tasas efectivas anuales de libre inversión",
      );
      return {
        mvDesde: numero(mv[1]),
        mvHasta: numero(mv[2]),
        eaDesde: numero(ea[1]),
        eaHasta: numero(ea[2]),
        vigencia: fecha(vig[1]),
        frase: `${mv[0]} · ${ea[0]}`,
      };
    },
  },

  davivienda: {
    // Dirección fija; libre inversión en la tabla "Créditos de Consumo".
    // Rechaza la descarga desde el servidor (403 con fetch, curl y Chromium,
    // oct 2026): se carga a mano.
    bloquea: true,
    leer(texto) {
      const t = plano(texto);
      const bloque = despuesDe(
        t,
        /CrediExpress Fijo - Tradicional/,
        'la tabla "CrediExpress Fijo - Tradicional"',
      );
      const m = exigir(
        bloque,
        /Libre Inversión ([\d,]+)% ([\d,]+)%/,
        "la fila de libre inversión",
      );
      // La vigencia que está justo después de la tabla de consumo.
      const vig = exigir(
        bloque,
        /Vigente a partir del ([^\n]+)/,
        "la vigencia",
      );
      return {
        mvDesde: numero(m[1]),
        eaDesde: numero(m[2]),
        mvHasta: null,
        eaHasta: null,
        vigencia: fecha(vig[1]),
        frase: m[0],
      };
    },
  },

  "av-villas": {
    // "Tasas Activas 01 <Mes> <Año>.pdf"; si la fuente tiene url_indice, se
    // busca ahí el enlace más nuevo.
    enlace: /[^"'\s<>]*Tasas(?:\+|%20| )Activas[^"'\s<>]*\.pdf[^"'\s<>]*/gi,
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /A partir del ([^\n]+)/, "la vigencia");
      const bloque = despuesDe(
        t,
        /TASAS CONSUMO LIBRE INVERSIÓN/,
        'la tabla "TASAS CONSUMO LIBRE INVERSIÓN"',
      );
      const desde = exigir(
        bloque,
        /Desde ([\d,]+)% E\.A\. - \( ([\d,]+)% M\.V\. \)/,
        'la tasa "Desde … E.A. - ( … M.V. )"',
      );
      const hasta = exigir(
        bloque,
        /Hasta ([\d,]+)% E\.A\. - \( ([\d,]+)% M\.V\. \)/,
        'la tasa "Hasta … E.A. - ( … M.V. )"',
      );
      return {
        eaDesde: numero(desde[1]),
        mvDesde: numero(desde[2]),
        eaHasta: numero(hasta[1]),
        mvHasta: numero(hasta[2]),
        vigencia: fecha(vig[1]),
        frase: `${desde[0]} · ${hasta[0]}`,
      };
    },
  },
};

/** M.V. → E.A. (en %). */
export const efectiva = (mv) => ((1 + mv / 100) ** 12 - 1) * 100;

/**
 * Revisa que lo leído tenga sentido; devuelve la lista de problemas (vacía
 * si está bien). Así una regla que lee el número equivocado no pasa callada.
 */
export function revisar(t, usura) {
  const problemas = [];
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  if (!ok(t.mvDesde) || !ok(t.eaDesde)) problemas.push("No leí la tasa desde.");
  else {
    if (t.eaDesde < 5 || t.eaDesde > usura.tasa + 0.01)
      problemas.push(`La tasa desde (${t.eaDesde} % E.A.) no es creíble.`);
    if (Math.abs(efectiva(t.mvDesde) - t.eaDesde) > 0.3)
      problemas.push(
        `La desde no cuadra: ${t.mvDesde} % M.V. equivale a ${efectiva(t.mvDesde).toFixed(2)} % E.A., no a ${t.eaDesde} %.`,
      );
  }
  if (t.eaHasta !== null) {
    if (!ok(t.mvHasta) || !ok(t.eaHasta))
      problemas.push("No leí la tasa hasta.");
    else {
      if (t.eaHasta > usura.tasa + 0.01)
        problemas.push(
          `La tasa hasta (${t.eaHasta} % E.A.) supera la usura (${usura.tasa} %).`,
        );
      if (ok(t.eaDesde) && t.eaHasta < t.eaDesde)
        problemas.push("La tasa hasta es menor que la desde.");
      if (Math.abs(efectiva(t.mvHasta) - t.eaHasta) > 0.3)
        problemas.push(
          `La hasta no cuadra: ${t.mvHasta} % M.V. equivale a ${efectiva(t.mvHasta).toFixed(2)} % E.A., no a ${t.eaHasta} %.`,
        );
    }
  }
  if (!t.vigencia) problemas.push("No leí desde cuándo rige.");
  return problemas;
}

/**
 * De los enlaces encontrados en la página índice, el del mes más reciente
 * (por el nombre del mes y el año en la dirección); si no se puede saber, el
 * primero.
 */
export function masReciente(enlaces) {
  const puntaje = (u) => {
    const t = decodeURIComponent(u).toLowerCase();
    // Año suelto: no el "2085" de "/10212085/".
    const año = Number(t.match(/(?<!\d)20\d\d(?!\d)/)?.[0] ?? 0);
    const mes = MESES.findIndex((m) => t.includes(m));
    return año * 100 + (mes + 1);
  };
  return [...enlaces].sort((a, b) => puntaje(b) - puntaje(a))[0] ?? null;
}
