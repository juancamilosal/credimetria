// Reglas por banco del robot de los PDF: dónde está el PDF de tasas y cómo
// leer de su texto (pdftotext -layout) la tasa de cada producto.
//
// La regla de libre inversión va con el código del banco ("bbva") y la de
// los demás productos con "<banco>:<producto>" ("bbva:libranza"); ver
// `reglaDe`. Si dos productos salen del mismo PDF, la de libranza copia la
// forma de buscarlo de la de libre inversión y solo cambia `leer`.
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
//   manual: true si el robot ni lo intenta (Lulo): solo va en el
//     recordatorio (los lunes, o a diario si no tiene ninguna tasa) y la tasa
//     se carga a mano en /admin/tasas.
//   bloquea: true si el banco rechaza descargas desde servidores (403 aun con
//     navegador) o su página no le muestra las tasas al servidor. Se sigue intentando, pero el aviso llega solo los lunes:
//     ese PDF se revisa y se sube a mano en /admin/tasas.
//   paginaVigente: { url, leer, pantallazo, clic?, navegador? } si el banco
//     también muestra la tasa en una página que se actualiza antes que el PDF:
//     se prefiere el PDF, salvo que la página rija desde una fecha más nueva.
//   elegir(enlaces) → de los enlaces encontrados con `enlace`, la dirección
//     del PDF más nuevo (si no, el del mes más reciente en el nombre).
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
    // JavaScript (el HTML no trae las tasas). Desde el VPS ni el navegador
    // recibe las tasas (26 caracteres, oct 2026) y abrirla demoraba y hacía
    // fallar la corrida: el robot ya no la abre (27 oct 2026). Va en el
    // recordatorio y se carga a mano; `leer` queda para --probar con la página
    // guardada.
    pagina: true,
    navegador: true,
    bloquea: true,
    manual: true,
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
    // "Cartelera Crediticia" mensual, en la página de tasas de crédito. Trae una
    // página para clientes y otra para asociados a Coomeva: se usa la de
    // clientes (la que le aplica a cualquiera). Solo publica "Tasa desde"
    // E.A.: hasta = usura.
    // En la página cada mes es un "descargar.php?idFile=<n>" (con o sin "/"
    // al comienzo y a veces con un espacio); el más nuevo tiene el número
    // más alto.
    enlace: /descargar\.php\?idFile=\s*\d+/gi,
    elegir: (enlaces) => {
      const numeros = enlaces.map((e) => Number(e.match(/\d+$/)[0]));
      return numeros.length
        ? `https://www.bancoomeva.com.co/descargar.php?idFile=${Math.max(...numeros)}`
        : null;
    },
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

  "banco-serfinanza": {
    // PDF mensual "TASAS-1-DE-<MES>-DE-<AÑO>.pdf" (wp-content/uploads/AAAA/MM),
    // enlazado en /servicio-al-cliente/tasas/. Tabla "Libre Inversión" (no la
    // de "Libranza Libre Inversión"): una tasa fija por monto ("Hasta $50 MM",
    // "Mayor a $50 MM"). Desde = la más baja, hasta = la más alta.
    enlace: /[^"'\s<>()]*TASAS-[^"'\s<>()]*\.pdf[^"'\s<>()]*/gi,
    leer(texto) {
      const t = plano(texto);
      const desde = despuesDe(
        t,
        /(?:^|\n) ?Libre Inversión Tasa M\.V\. Tasa E\.A\./m,
        'la tabla "Libre Inversión" (no la de libranza)',
      );
      const fin = desde.search(/Nota:/);
      const tabla = fin > 0 ? desde.slice(0, fin) : desde.slice(0, 1500);
      const filas = [
        ...tabla.matchAll(
          /(?:Hasta|Mayor a) \$ ?\d+ ?MM ([\d,]+)% Nominal M\.V ([\d,]+)% EA/g,
        ),
      ];
      if (!filas.length)
        throw new ReglaRota(
          'No encontré las filas "Hasta / Mayor a $… MM" de libre inversión en el documento.',
        );
      const vig = exigir(
        desde,
        /Vigencia de tasas a partir del ([^\n]+)/,
        "la vigencia de libre inversión",
      );
      const mv = filas.map((f) => numero(f[1]));
      const ea = filas.map((f) => numero(f[2]));
      return {
        mvDesde: Math.min(...mv),
        mvHasta: Math.max(...mv),
        eaDesde: Math.min(...ea),
        eaHasta: Math.max(...ea),
        vigencia: fecha(vig[1]),
        frase: filas.map((f) => f[0]).join(" · "),
      };
    },
  },

  "banco-finandina": {
    // Un PDF por mes: /hubfs/Backup Sitefinity/Files/historial tasas y
    // tarifas/tasas/tasas-<mes>-<año>.pdf (también en la página de
    // historial). Fila "Préstamo para libre inversión Desde … NMV -
    // Equivalente al … EA": solo el desde; hasta = usura.
    enlace: /[^"'\s<>()]*tasas-\p{L}+-\d{4}\.pdf/giu,
    // Su página de tasas vigentes se actualiza antes que el PDF del historial
    // (el 26 oct 2026 la página ya tenía octubre y el último PDF era de
    // septiembre): si la página es más nueva, se usa con pantallazo.
    paginaVigente: {
      url: "https://www.bancofinandina.com/servicio-al-cliente/tasas-y-tarifas/tasas-vigentes",
      pantallazo: "Préstamo para libre inversión",
      clic: "Tasas de interés",
      leer(texto) {
        const t = texto.replace(/\s+/g, " ");
        const vig = exigir(
          t,
          /Las tasas aplican a partir del (\d{1,2} de \p{L}+ de \d{4})/u,
          'la fecha "Las tasas aplican a partir del …"',
        );
        const m = exigir(
          t,
          /Préstamo para libre inversión Desde ([\d.,]+)% NMV . Equivalente al ([\d.,]+)% EA/,
          'la fila "Préstamo para libre inversión"',
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
    buscar(fuente, hoy) {
      const base =
        "https://www.bancofinandina.com/hubfs/Backup%20Sitefinity/Files/historial%20tasas%20y%20tarifas/tasas/";
      const nuevo = `${base}tasas-${MESES[hoy.getMonth()]}-${hoy.getFullYear()}.pdf`;
      return [nuevo, fuente.url].filter((u, i, l) => u && l.indexOf(u) === i);
    },
    leer(texto) {
      const t = plano(texto);
      // "Tasas vigentes Septiembre 2026"
      const vig = exigir(
        t,
        /Tasas vigentes (\p{L}+) (\d{4})/u,
        "el mes de las tasas vigentes",
      );
      const m = exigir(
        t,
        /Préstamo para libre inversión Desde ([\d.,]+)% NMV . Equivalente al ([\d.,]+)% EA/,
        'la fila "Préstamo para libre inversión"',
      );
      return {
        mvDesde: numero(m[1]),
        eaDesde: numero(m[2]),
        mvHasta: null,
        eaHasta: null,
        vigencia: fecha(`1 de ${vig[1]} de ${vig[2]}`),
        frase: m[0],
      };
    },
  },

  "banco-agrario": {
    // PDF semanal "Tasas_colocaciones_del_26oct_al_01nov_2026.pdf" (15
    // páginas). Libre inversión: sección "CREDITOS CON RECURSOS PROPIOS DEL
    // <d> AL <d> DE <MES> DE <AÑO>" → "Creditos de Consumo". Publica una tasa
    // fija por línea: desde = "PERSONAL - LIBRE DESTINO" (oficina) y hasta =
    // "CREDITO DIGITAL LIBRE INVERSIÓN" (decisión del 26 oct 2026).
    enlace: /[^"'\s<>()]*Tasas[_-]colocaciones[^"'\s<>()]*\.pdf[^"'\s<>()]*/gi,
    // El más nuevo es el que empieza más tarde: "del_26oct_al_01nov_2026".
    elegir: (enlaces) => {
      const inicio = (e) => {
        const m = decodeURIComponent(e)
          .toLowerCase()
          .match(/del_(\d{1,2})([a-z]{3})_al_\d{1,2}[a-z]{3}_(\d{4})/);
        if (!m) return "";
        const mes = MESES.findIndex((x) => x.startsWith(m[2])) + 1;
        return `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      };
      return (
        [...enlaces].sort((a, b) => (inicio(b) > inicio(a) ? 1 : -1))[0] ?? null
      );
    },
    leer(texto) {
      const t = plano(texto);
      const i = t.search(/Creditos de Consumo/);
      if (i < 0)
        throw new ReglaRota(
          'No encontré la sección "Creditos de Consumo" en el documento.',
        );
      // La fecha de la sección de recursos propios, justo antes.
      const fechas = [
        ...t
          .slice(0, i)
          .matchAll(/DEL (\d{1,2}) AL \d{1,2} DE (\p{L}+) DE (\d{4})/gu),
      ];
      if (!fechas.length)
        throw new ReglaRota(
          'No encontré la fecha "DEL … AL … DE … DE …" de los créditos con recursos propios.',
        );
      const [, dia, mes, año] = fechas.at(-1);
      const consumo = t.slice(i);
      const oficina = exigir(
        consumo,
        /PERSONAL - LIBRE DESTINO [^\n]*? ([\d.,]+)%/,
        'la línea "PERSONAL - LIBRE DESTINO"',
      );
      const digital = consumo.match(
        /CREDITO DIGITAL LIBRE INVERSI[OÓ]N [^\n]*? ([\d.,]+)%/,
      );
      const eaDesde = numero(oficina[1]);
      const eaHasta = digital ? numero(digital[1]) : null;
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta,
        mvHasta: eaHasta === null ? null : mensual(eaHasta),
        vigencia: fecha(`${dia} de ${mes.toLowerCase()} de ${año}`),
        frase:
          `${eaDesde} % E.A. Personal - Libre destino (oficina)` +
          (digital
            ? ` · ${eaHasta} % E.A. Crédito digital libre inversión`
            : ""),
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

/**
 * Libranza: la Superfinanciera la reporta junta ("Libranza otros"), así que
 * no se separa por tipo de cliente. Desde = la tasa fija más baja de la
 * tabla de libranza del banco (pensionados, docentes, empleados…); hasta =
 * la más alta si el banco la publica, si no la usura. Los convenios
 * especiales (Policía, Grupo Olímpica…) no cuentan: no son para cualquiera.
 */
Object.assign(REGLAS, {
  "bbva:libranza": {
    // PDF aparte de dirección fija (DO-01-tasas-libranza.pdf): "Tasas desde"
    // por segmento (pensionados y otros), en E.A. y M.V.
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(
        t,
        /VIGENTES DESDE (\d{1,2} DE \p{L}+ DE \d{4})/u,
        'la fecha "VIGENTES DESDE …"',
      );
      const filas = [
        ...despuesDe(t, /Crédito de Libranza/, 'la tabla "Crédito de Libranza"')
          .split(/\* Las tasas/)[0]
          .matchAll(/destinos ([\d.,]+)% ([\d.,]+)%/g),
      ];
      if (!filas.length)
        throw new ReglaRota(
          'No encontré las tasas por segmento de "Crédito de Libranza".',
        );
      const menor = filas.reduce((a, b) =>
        numero(b[1]) < numero(a[1]) ? b : a,
      );
      return {
        eaDesde: numero(menor[1]),
        mvDesde: numero(menor[2]),
        eaHasta: null,
        mvHasta: null,
        vigencia: fecha(vig[1]),
        frase: filas.map((f) => f[0]).join(" · "),
      };
    },
  },

  "banco-caja-social:libranza": {
    // PDF aparte de dirección fija …/credito-consumo/Tasas-Libranzas.pdf (en
    // la misma página que el de libre destino): filas "Libranza" y "Libranza
    // Compra de Cartera", E.A. y M.V. desde y hasta. Vigencia "19-jun-2026".
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /Vigentes a partir del ([^\n]+)/, "la vigencia");
      const filas = [
        ...t.matchAll(
          /Libranza[^\n%]*? ([\d.,]+)% ([\d.,]+)% ([\d.,]+)% ([\d.,]+)%/g,
        ),
      ];
      if (!filas.length)
        throw new ReglaRota('No encontré las filas "Libranza" de la tabla.');
      const menor = filas.reduce((a, b) =>
        numero(b[1]) < numero(a[1]) ? b : a,
      );
      const mayor = filas.reduce((a, b) =>
        numero(b[3]) > numero(a[3]) ? b : a,
      );
      return {
        eaDesde: numero(menor[1]),
        mvDesde: numero(menor[2]),
        eaHasta: numero(mayor[3]),
        mvHasta: numero(mayor[4]),
        vigencia: fecha(vig[1]),
        frase: filas.map((f) => f[0].trim()).join(" · "),
      };
    },
  },

  "banco-de-bogota:libranza": {
    // Mismo PDF mensual. Tablas "LIBRANZAS … (Desde)" por pagaduría y plazo
    // (Tasa Mes, Tasa E.A.), al final del PDF; la primera fila de cada tabla
    // ("Hasta 36 meses") queda antes de su título.
    ...REGLAS["banco-de-bogota"],
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /Vigentes desde ([^\n]+)/, "la vigencia");
      const i = t.search(/LIBRANZAS EMPRESAS PRIVADAS/);
      if (i < 0)
        throw new ReglaRota(
          'No encontré las tablas "LIBRANZAS … (Desde)" en el PDF.',
        );
      const inicio = t.lastIndexOf("Línea Plazo Tasa Mes Tasa E.A.", i);
      const fin = t.indexOf("\f", i);
      const bloque = t.slice(
        inicio < 0 ? i : inicio,
        fin < 0 ? undefined : fin,
      );
      const filas = [...bloque.matchAll(/([\d.]+)% ([\d.]+)%/g)];
      const menor = filas.reduce((a, b) =>
        numero(b[2]) < numero(a[2]) ? b : a,
      );
      return {
        mvDesde: numero(menor[1]),
        eaDesde: numero(menor[2]),
        mvHasta: null,
        eaHasta: null,
        vigencia: fecha(vig[1]),
        frase: `Libranzas (desde, la más baja de todas las pagadurías y plazos): ${menor[0]}`,
      };
    },
  },

  "davivienda:libranza": {
    // Mismo PDF (se carga a mano). Página "Créditos de Libranza": CrediExpress
    // Fijo Libranza (móvil y tradicional) y Cx Rotativo, "TASAS DESDE" M.V. y
    // E.A.; la vigencia está en el encabezado de esa página.
    ...REGLAS.davivienda,
    leer(texto) {
      const t = plano(texto);
      const i = t.search(/Créditos de Libranza/);
      if (i < 0)
        throw new ReglaRota('No encontré la página "Créditos de Libranza".');
      const vigencias = [
        ...t.slice(0, i).matchAll(/Vigente a partir del ([^\n]+)/g),
      ];
      if (!vigencias.length)
        throw new ReglaRota(
          "No encontré la vigencia de la página de libranza.",
        );
      const tabla = t.slice(i).split(/\n Mora /)[0];
      const filas = [...tabla.matchAll(/([\d,]+)% ([\d,]+)%/g)];
      if (!filas.length)
        throw new ReglaRota("No encontré las tasas de la tabla de libranza.");
      const menor = filas.reduce((a, b) =>
        numero(b[2]) < numero(a[2]) ? b : a,
      );
      return {
        mvDesde: numero(menor[1]),
        eaDesde: numero(menor[2]),
        mvHasta: null,
        eaHasta: null,
        vigencia: fecha(vigencias.at(-1)[1]),
        frase: tabla.replace(/\s+/g, " ").trim().slice(0, 400),
      };
    },
  },

  "av-villas:libranza": {
    // Mismo PDF. "Créditos de Consumo" → fila LIBRANZA: Desde y Hasta en E.A.
    // (la M.V. se calcula). En el texto, el "Desde" queda antes de "LIBRANZA".
    ...REGLAS["av-villas"],
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(t, /A partir del ([^\n]+)/, "la vigencia");
      const m = exigir(
        t,
        /Desde ([\d,]+)% E\.A\.[^\n]*\n ?LIBRANZA\n ?Hasta ([\d,]+)% E\.A\./,
        'la fila "LIBRANZA" (Desde … Hasta …)',
      );
      const eaDesde = numero(m[1]);
      const eaHasta = numero(m[2]);
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta,
        mvHasta: mensual(eaHasta),
        vigencia: fecha(vig[1]),
        frase: `Libranza: desde ${m[1]}% E.A. hasta ${m[2]}% E.A.`,
      };
    },
  },

  "bancolombia:libranza": {
    // Mismo PDF. "…tasas vigentes a partir del <fecha>, para las Libranzas":
    // Empleados y Fopep, cada una con tasa fija (M.V. y E.A.) y variable (IBR
    // + puntos, solo E.A.). Se usan las fijas: las E.A. que cuadran con su M.V.
    ...REGLAS.bancolombia,
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(
        t,
        /vigentes a partir del ([^,\n]+), para\s*\n?\s*las Libranzas/,
        "la vigencia de las libranzas",
      );
      const bloque = despuesDe(
        t,
        /para\s*\n?\s*las Libranzas/,
        'el texto "para las Libranzas"',
      ).split(/A continuación/)[0];
      const mv = [
        ...bloque.matchAll(/([\d.]+)% Mes Vencida ([\d.]+)% Mes Vencida/g),
      ];
      const ea = [...bloque.matchAll(/([\d.]+)% Efectiva Anual/g)].map((m) =>
        numero(m[1]),
      );
      if (!mv.length || !ea.length)
        throw new ReglaRota("No encontré las tasas fijas de libranza.");
      // La E.A. publicada que corresponde a una M.V.
      const suEa = (m) =>
        ea.reduce((a, b) =>
          Math.abs(b - efectiva(m)) < Math.abs(a - efectiva(m)) ? b : a,
        );
      const mvDesde = Math.min(...mv.map((m) => numero(m[1])));
      const mvHasta = Math.max(...mv.map((m) => numero(m[2])));
      return {
        mvDesde,
        eaDesde: suEa(mvDesde),
        mvHasta,
        eaHasta: suEa(mvHasta),
        vigencia: fecha(vig[1]),
        frase: `Libranza tasa fija (empleados y Fopep): ${mv.map((m) => m[0]).join(" · ")}`,
      };
    },
  },

  "banco-agrario:libranza": {
    // Mismo PDF semanal. Tabla "Credito de Libranza" (empleados y
    // pensionados, sector público y privado, libre inversión, retanqueo y
    // compra de cartera) en E.A. por plazo; los "Convenios Especiales" de
    // abajo no cuentan.
    ...REGLAS["banco-agrario"],
    leer(texto) {
      const t = plano(texto);
      const i = t.search(/Credito de Libranza/);
      if (i < 0)
        throw new ReglaRota('No encontré la tabla "Credito de Libranza".');
      const fechas = [
        ...t
          .slice(0, i)
          .matchAll(/DEL (\d{1,2}) AL \d{1,2} DE (\p{L}+) DE (\d{4})/gu),
      ];
      if (!fechas.length)
        throw new ReglaRota(
          'No encontré la fecha "DEL … AL … DE … DE …" antes de libranza.',
        );
      const [, dia, mes, año] = fechas.at(-1);
      const tabla = t.slice(i).split(/Libranza Convenios Especiales/)[0];
      const tasas = [...tabla.matchAll(/(\d{2},\d{2})%/g)].map((m) =>
        numero(m[1]),
      );
      if (!tasas.length)
        throw new ReglaRota("No encontré las tasas de la tabla de libranza.");
      const eaDesde = Math.min(...tasas);
      const eaHasta = Math.max(...tasas);
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta,
        mvHasta: mensual(eaHasta),
        vigencia: fecha(`${dia} de ${mes.toLowerCase()} de ${año}`),
        frase: `Crédito de libranza (empleados y pensionados): de ${eaDesde} % a ${eaHasta} % E.A.`,
      };
    },
  },

  "banco-serfinanza:libranza": {
    // Mismo PDF mensual. Tabla "Libranza Libre Inversión": convenios y
    // pensionados por monto (M.V. y E.A.). Las de Grupo Olímpica son solo
    // para sus empleados: no cuentan.
    ...REGLAS["banco-serfinanza"],
    leer(texto) {
      const t = plano(texto);
      const desde = despuesDe(
        t,
        /Libranza Libre Inversión Tasa M\.V\./,
        'la tabla "Libranza Libre Inversión"',
      );
      const fin = desde.search(/\*Vigencia de tasas/);
      const tabla = (
        fin > 0 ? desde.slice(0, fin) : desde.slice(0, 1500)
      ).replace(/\s+/g, " ");
      const vig = exigir(
        desde,
        /Vigencia de tasas a partir del ([^\n]+)/,
        "la vigencia de libranza",
      );
      const filas = [
        ...tabla.matchAll(
          /(Libranzas? [^%]*?)(?:Desde )?([\d,]+)%[^%]*?(?:Desde )?([\d,]+)% E\.A\./g,
        ),
      ].filter((f) => !/Olímpica/.test(f[1]));
      if (!filas.length)
        throw new ReglaRota(
          'No encontré las filas de "Libranza Libre Inversión".',
        );
      const mv = filas.map((f) => numero(f[2]));
      const ea = filas.map((f) => numero(f[3]));
      return {
        mvDesde: Math.min(...mv),
        mvHasta: Math.max(...mv),
        eaDesde: Math.min(...ea),
        eaHasta: Math.max(...ea),
        vigencia: fecha(vig[1]),
        frase: filas
          .map((f) => f[0].trim())
          .join(" · ")
          .slice(0, 400),
      };
    },
  },

  "banco-finandina:libranza": {
    // Mismo PDF mensual y misma página de tasas vigentes: fila "Libranza
    // Desde … NMV – Equivalente al … EA" (solo desde; hasta = usura).
    ...REGLAS["banco-finandina"],
    paginaVigente: {
      ...REGLAS["banco-finandina"].paginaVigente,
      pantallazo: "Libranza",
      leer(texto) {
        const t = texto.replace(/\s+/g, " ");
        const vig = exigir(
          t,
          /Las tasas aplican a partir del (\d{1,2} de \p{L}+ de \d{4})/u,
          'la fecha "Las tasas aplican a partir del …"',
        );
        return finandinaLibranza(t, fecha(vig[1]));
      },
    },
    leer(texto) {
      const t = plano(texto);
      const vig = exigir(
        t,
        /Tasas vigentes (\p{L}+) (\d{4})/u,
        "el mes de las tasas vigentes",
      );
      return finandinaLibranza(t, fecha(`1 de ${vig[1]} de ${vig[2]}`));
    },
  },

  "bancoomeva:libranza": {
    // Misma cartelera mensual, página de clientes: fila "Libre Inversion" de
    // LIBRANZA ("Tasa desde" E.A.; hasta = usura).
    ...REGLAS.bancoomeva,
    leer(texto) {
      const t = plano(texto);
      const clientes = despuesDe(
        t,
        /Aplica para Clientes Bancoomeva/,
        'la página "Aplica para Clientes Bancoomeva"',
      );
      const vig = exigir(
        clientes,
        /Vigentes mes de (\d{1,2}) al \d{1,2} (\p{L}+) (\d{4})/u,
        "la vigencia del mes",
      );
      const m = exigir(
        clientes,
        /Libre Inversi[oó]n [^\n]*? ([\d,]+) ?% E\.A\s*\n ?LIBRANZA/,
        'la fila "Libre Inversión" de LIBRANZA',
      );
      const eaDesde = numero(m[1]);
      return {
        eaDesde,
        mvDesde: mensual(eaDesde),
        eaHasta: null,
        mvHasta: null,
        vigencia: fecha(`${vig[1]} de ${vig[2]} de ${vig[3]}`),
        frase: `Libranza: ${m[0].replace(/\s+/g, " ")}`,
      };
    },
  },
});

/** Fila "Libranza Desde … NMV – Equivalente al … EA" de Finandina. */
function finandinaLibranza(t, vigencia) {
  const m = exigir(
    t,
    /Libranza Desde ([\d.,]+)% NMV . Equivalente al ([\d.,]+)% EA/,
    'la fila "Libranza"',
  );
  return {
    mvDesde: numero(m[1]),
    eaDesde: numero(m[2]),
    mvHasta: null,
    eaHasta: null,
    vigencia,
    frase: m[0],
  };
}

/**
 * La regla de un banco para un producto: la de libre inversión es la del
 * código del banco y la de los demás, "<banco>:<producto>".
 */
export function reglaDe(banco, producto = "libre-inversion") {
  return REGLAS[
    producto === "libre-inversion" ? banco : `${banco}:${producto}`
  ];
}

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
    if (t.eaDesde > usura.tasa + 0.01)
      problemas.push(
        `La tasa desde (${t.eaDesde} % E.A.) supera la usura de ${usura.mes ?? "este mes"} (${usura.tasa} %): el documento puede ser de un mes anterior.`,
      );
    else if (t.eaDesde < 5)
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
