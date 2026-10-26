// Reglas por banco del robot de los PDF: dónde está el PDF de tasas y cómo
// leer de su texto (pdftotext -layout) la tasa de libre inversión.
//
// Cada regla tiene:
//   pagina: true si el banco no publica PDF y la tasa está en su página web
//     (fuente de tipo "pagina"). El robot lee el texto de la página y, si la
//     tasa cambió, guarda un pantallazo de la tabla (`pantallazo`: texto
//     que identifica la tabla) como prueba.
//   mensual: true si el banco publica un PDF nuevo cada mes con otra dirección
//     y su página índice bloquea al servidor (Falabella). El robot revisa el
//     PDF guardado y, si ya es de un mes anterior, lo pone en el recordatorio
//     para subir a mano el del mes.
//   navegador: true si la página se arma con JavaScript y el texto solo se ve
//     abriéndola con Chromium.
//   bloquea: true si el banco rechaza descargas desde servidores (403 aun con
//     navegador) o su página no le muestra las tasas al servidor. Se sigue intentando, pero el aviso llega solo los lunes:
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

/**
 * "1 de Octubre de 2026", "Octubre 05 de 2026", "Febrero 5/2026", "18-Jun-2026"
 * u "octubre de 2026" → AAAA-MM-DD.
 */
export function fecha(texto) {
  const t = texto.toLowerCase();
  let m = t.match(/(\d{1,2}) de (\p{L}+) (?:de )?(\d{4})/u);
  if (m && MESES.includes(m[2])) return iso(m[3], m[2], m[1]);
  m = t.match(/(\p{L}+) (\d{1,2}) de (\d{4})/u);
  if (m && MESES.includes(m[1])) return iso(m[3], m[1], m[2]);
  m = t.match(/(\p{L}+) (\d{1,2})\/(\d{4})/u);
  if (m && MESES.includes(m[1])) return iso(m[3], m[1], m[2]);
  m = t.match(/(\d{1,2})-(\p{L}{3})-(\d{4})/u);
  if (m) {
    const mes = MESES.find((x) => x.startsWith(m[2]));
    if (mes) return iso(m[3], mes, m[1]);
  }
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
  if (!m) throw new ReglaRota(`No encontré ${queBusca} en el documento.`);
  return m;
}

/** Desde el primer `ancla` hasta el final (o error si no está). */
function despuesDe(texto, ancla, queBusca) {
  const i = texto.search(ancla);
  if (i < 0) throw new ReglaRota(`No encontré ${queBusca} en el documento.`);
  return texto.slice(i);
}

export const REGLAS = {
  "banco-popular": {
    // No publica PDF: la tabla "Préstamo Personal de Libre Destino" está en
    // su página de tasas. Solo publica E.A. (una por rango de monto).
    pagina: true,
    pantallazo: "Préstamo Personal de Libre Destino E.A.",
    leer(texto) {
      const t = plano(texto);
      const desde = despuesDe(
        t,
        /Préstamo Personal de Libre Destino E\.A\./,
        'la tabla "Préstamo Personal de Libre Destino E.A."',
      );
      // Hasta la tabla siguiente (la de compra de cartera).
      const fin = desde.indexOf("Préstamo Personal", 10);
      const tabla = fin > 0 ? desde.slice(0, fin) : desde.slice(0, 1500);
      const vig = exigir(
        tabla,
        /vigentes a partir de ([^)]+)\)/,
        "la vigencia de la tabla",
      );
      const rangos = [...tabla.matchAll(/Desde ([\d,]+)% hasta ([\d,]+)%/g)];
      if (!rangos.length)
        throw new ReglaRota(
          'No encontré las tasas "Desde … hasta …" de la tabla de libre destino.',
        );
      const eaDesde = Math.min(...rangos.map((r) => numero(r[1])));
      const eaHasta = Math.max(...rangos.map((r) => numero(r[2])));
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta,
        mvHasta: mensual(eaHasta),
        vigencia: fecha(vig[1]),
        frase: tabla.trim().replace(/\s+/g, " ").slice(0, 400),
      };
    },
  },

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

  "banco-falabella": {
    // "TASAS DE INTERÉS VIGENTES" (p. ej. 02-VERTICAL-TASAS-OCT-2026.pdf, en
    // assets.ctfassets.net), enlazado en la página de tasas y tarifas
    // (url_indice) junto al de tarifas. Esa página responde 403 al servidor
    // (también con Chromium, oct 2026): cada mes se sube a mano.
    mensual: true,
    enlace: /[^"'\s<>()]*TASAS[^"'\s<>()]*\.pdf[^"'\s<>()]*/gi,
    leer(texto) {
      const t = plano(texto);
      const bloque = despuesDe(
        t,
        /Crédito de Libre Inversión/,
        'la tabla "Crédito de Libre Inversión"',
      );
      // "Vigencia: 01 al 31 de octubre de 2026": rige desde el primer día.
      const vig = exigir(
        bloque,
        /Vigencia: (\d{1,2}) al \d{1,2} de ([^\n]+)/,
        "la vigencia de libre inversión",
      );
      const mv = exigir(
        bloque,
        /Mes Vencida ([\d,]+)% M\.V\. ([\d,]+)% M\.V\./,
        'la fila "Mes Vencida" de libre inversión',
      );
      const ea = exigir(
        bloque,
        /Efectiva Anual ([\d,]+)% E\.A\. ([\d,]+)% E\.A\./,
        'la fila "Efectiva Anual" de libre inversión',
      );
      return {
        mvDesde: numero(mv[1]),
        mvHasta: numero(mv[2]),
        eaDesde: numero(ea[1]),
        eaHasta: numero(ea[2]),
        vigencia: fecha(`${vig[1]} de ${vig[2]}`),
        frase: `${mv[0]} · ${ea[0]}`,
      };
    },
  },

  davibank: {
    // Antes Scotiabank Colpatria. PDF "Tasas y productos crédito"
    // (Tasas-y-productos-credito-2026.pdf), enlazado en davibank.com/tasas-y-tarifas.
    // Libre inversión solo en E.A. (desde y hasta); la M.V. se calcula.
    enlace:
      /[^"'\s<>()]*Tasas-y-productos-credito[^"'\s<>()]*\.pdf[^"'\s<>()]*/gi,
    leer(texto) {
      const t = plano(texto);
      // "Vigentes mes de Octubre (del día 1 al día 31) 2026"
      const vig = exigir(
        t,
        /Vigentes mes de (\p{L}+) \(del día (\d{1,2}) al día \d{1,2}\) (\d{4})/u,
        "la vigencia del mes",
      );
      const bloque = despuesDe(
        t,
        /Consumo Libre Inversión/,
        'la tabla "Consumo Libre Inversión"',
      );
      const m = exigir(
        bloque,
        /Corriente desde \** ?([\d,]+)% ([\d,]+)%/,
        'la fila "Corriente desde" de libre inversión',
      );
      const eaDesde = numero(m[1]);
      const eaHasta = numero(m[2]);
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta,
        mvHasta: mensual(eaHasta),
        vigencia: fecha(`${vig[2]} de ${vig[1]} de ${vig[3]}`),
        frase: m[0],
      };
    },
  },

  "banco-de-occidente": {
    // Dirección fija /documents/d/guest/tasas-personas-bdo (cambia el
    // contenido). PDF de 18 páginas con todo: libre inversión está en
    // "Cupo línea Préstamo Personal", columnas LIBRE INVERSIÓN (desde, hasta)
    // y COMPRA DE CARTERA (desde, hasta). Debajo, el crédito rotativo.
    leer(texto) {
      const t = plano(texto);
      const bloque = despuesDe(
        t,
        /Cupo línea Préstamo Personal/,
        'la tabla "Cupo línea Préstamo Personal"',
      );
      const mv = exigir(
        bloque,
        /Tasa M\.V ([\d,]+)% ([\d,]+)%/,
        'la fila "Tasa M.V" de libre inversión',
      );
      const ea = exigir(
        bloque,
        /Tasa E\.A ([\d,]+)% ([\d,]+)%/,
        'la fila "Tasa E.A" de libre inversión',
      );
      // "*Vigencia del 01 al 31 de Octubre de 2026"
      const vig = exigir(
        bloque,
        /Vigencia del (\d{1,2}) al \d{1,2} de ([^\n]+)/,
        "la vigencia del préstamo personal",
      );
      return {
        mvDesde: numero(mv[1]),
        mvHasta: numero(mv[2]),
        eaDesde: numero(ea[1]),
        eaHasta: numero(ea[2]),
        vigencia: fecha(`${vig[1]} de ${vig[2]}`),
        frase: `Libre inversión: ${mv[0]} · ${ea[0]}`,
      };
    },
  },

  "banco-caja-social": {
    // Dirección fija .../credito-consumo/Tasas-Credito-Libre-Destino.pdf
    // (una página). Fila "Libre Inversión": E.A. y M.V. desde, E.A. y M.V.
    // hasta. No es mensual: "Vigentes a partir del 18-Jun-2026".
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /Vigentes a partir del ([^\n]+)/, "la vigencia");
      const m = exigir(
        t,
        /Libre Inversión ([\d.,]+)% ([\d.,]+)% ([\d.,]+)% ([\d.,]+)%/,
        'la fila "Libre Inversión"',
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

  "lulo-bank": {
    // No publica PDF: página legal "Tasas y tarifas del crédito" con un solo
    // rango "Desde … M.V - … EA hasta … M.V - … EA". La página se arma con
    // JavaScript (el HTML no trae las tasas): se lee con el navegador. Desde
    // el VPS ni el navegador recibe las tasas (26 caracteres, oct 2026): queda
    // en el recordatorio de los lunes y se carga a mano.
    pagina: true,
    navegador: true,
    bloquea: true,
    pantallazo: "Tasas y tarifas del crédito",
    leer(texto) {
      // En el navegador cada línea puede quedar aparte: todo en una línea.
      const t = texto.replace(/\s+/g, " ");
      const vig = exigir(
        t,
        /vigentes desde el (\d{1,2} de \p{L}+ de \d{4})/u,
        "la vigencia de las tasas",
      );
      const m = exigir(
        t,
        /Desde ([\d.,]+)% M\.?V\.? - ([\d.,]+)% E\.?A\.? hasta ([\d.,]+)% M\.?V\.? - ([\d.,]+)% E\.?A/,
        'el rango "Desde … M.V - … EA hasta … M.V - … EA"',
      );
      return {
        mvDesde: numero(m[1]),
        eaDesde: numero(m[2]),
        mvHasta: numero(m[3]),
        eaHasta: numero(m[4]),
        vigencia: fecha(vig[1]),
        frase: m[0],
      };
    },
  },

  bancoomeva: {
    // "Cartelera Crediticia" mensual (Cartelera_Crediticia_v278.pdf…), en
    // la página de tasas de crédito, con el mes más nuevo primero. Trae una
    // página para clientes y otra para asociados a Coomeva: se usa la de
    // clientes (la que le aplica a cualquiera). Solo publica "Tasa desde"
    // E.A.: hasta = usura.
    enlace:
      /[^"'\s<>()]*Cartelera[_-]Crediticia[^"'\s<>()]*\.pdf[^"'\s<>()]*/gi,
    leer(texto) {
      const t = plano(texto);
      const clientes = despuesDe(
        t,
        /Aplica para Clientes Bancoomeva/,
        'la página "Aplica para Clientes Bancoomeva"',
      );
      // "Vigentes mes de 01 al 31 octubre 2026."
      const vig = exigir(
        clientes,
        /Vigentes mes de (\d{1,2}) al \d{1,2} (\p{L}+) (\d{4})/u,
        "la vigencia del mes",
      );
      const m = exigir(
        clientes,
        /Libre Inversi[oó]n [^\n]*? ([\d,]+) ?% E\.A/,
        'la fila "Libre Inversión" de crédito de consumo',
      );
      const eaDesde = numero(m[1]);
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta: null,
        mvHasta: null,
        vigencia: fecha(`${vig[1]} de ${vig[2]} de ${vig[3]}`),
        frase: m[0].replace(/\s+/g, " "),
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

/** E.A. → M.V. (en %), con 4 decimales, para bancos que solo publican E.A. */
export const mensual = (ea) =>
  +(((1 + ea / 100) ** (1 / 12) - 1) * 100).toFixed(4);

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
    let mes = MESES.findIndex((m) => t.includes(m));
    // Meses abreviados: "TASAS-OCT-2026".
    if (mes < 0)
      mes = MESES.findIndex((m) =>
        new RegExp(`(^|[^a-z])${m.slice(0, 3)}([^a-z]|$)`).test(t),
      );
    return año * 100 + (mes + 1);
  };
  return [...enlaces].sort((a, b) => puntaje(b) - puntaje(a))[0] ?? null;
}

/**
 * Lo leído (`leida`, con el hasta ya resuelto) es igual a una tasa guardada
 * en Directus (`guardada`: valor_desde, valor_hasta, ea_desde y ea_hasta, que
 * llegan como texto). Si es igual, el PDF cambió pero las tasas no.
 */
export function mismasTasas(leida, guardada) {
  const campos = ["valor_desde", "valor_hasta", "ea_desde", "ea_hasta"];
  return campos.every(
    (c) =>
      guardada[c] !== null &&
      guardada[c] !== undefined &&
      Math.abs(Number(guardada[c]) - leida[c]) < 0.0001,
  );
}

/**
 * El último PDF guardado de un banco mensual ya es de un mes anterior al de
 * `hoy` (desde el día 2, para darle al banco un día para publicar).
 */
export function mesVencido(vigenteDesde, hoy) {
  if (hoy.getDate() < 2) return false;
  if (!vigenteDesde) return true;
  const [año, mes] = vigenteDesde.split("-").map(Number);
  return año * 12 + mes < hoy.getFullYear() * 12 + hoy.getMonth() + 1;
}
