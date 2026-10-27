# Robots de Credimetría

Dónde busca cada robot y qué guarda en Directus
(`credimetria-api.valkiriacode.com`). Corren en el VPS como tareas
programadas de Coolify, con el token de un usuario "Robot" que solo puede
crear tasas por aprobar, actualizar fuentes y promedios, y subir archivos.

## 1. Robot del promedio (`promedio-sfc.mjs`) · listo, falta ponerlo a correr

- **Fuente:** Superintendencia Financiera, formato 88, en datos.gov.co:
  conjunto `qzsc-9esp` ("Tasas de interés activas por tipo de crédito –
  últimos dos meses"). El histórico está en `w9zh-vetq`.
- **Cómo:** por entidad (`entidades.codigo_sfc`, tipo-código: Bogotá 1-1,
  Bancolombia 1-7, BBVA 1-13, Davivienda 1-39, AV Villas 1-49) y producto
  (`Libre inversión` y `Libranza otros`: la Superfinanciera reporta la
  libranza junta, sin separar pensionados, docentes o empleados), promedio
  ponderado por monto de las últimas 4 semanas. Hace **una consulta por
  banco con todos los productos** (agrupada por producto y semana): sumar
  todos los bancos juntos pasaba de ~30 s y datos.gov.co cortaba la
  conexión. Cada consulta tiene 2 minutos de límite y hasta 3 intentos; cada
  banco guarda el enlace de su propia consulta.
- Si un banco no tiene un producto (p. ej. libranza en Lulo, Falabella o
  Davibank) y nunca tuvo promedio de él, no se crea fila ni se avisa.
- **Guarda:** una fila por entidad y producto en `tasas_promedio`
  (sobrescribe, sin historial, sin aprobación), con la fecha de corte, el
  CSV de respaldo y el enlace de la consulta. Avisa en las notas si una
  tasa salta más de 2 puntos, y marca "Sin reporte" si el banco no reportó.
- **Cada cuánto:** una vez por semana (la Superfinanciera publica cortes
  semanales con unos días de retraso).
- **Probar sin guardar:** `node robots/promedio-sfc.mjs --sin-guardar`.

Primer resultado guardado (corte 16 oct 2026, 4 semanas): AV Villas
19,57 %, Bancolombia 21,03 %, BBVA 21,81 %, Banco de Bogotá 22,71 % y
Davivienda 22,71 % E.A.

## 2. Robot de los PDF (`pdf-bancos.mjs`) · listo, falta ponerlo a correr

- **Qué hace:** lee `fuentes` (tipo PDF, estado activa) y, con la regla de
  cada banco (`reglas.mjs`), busca y baja su PDF. Si la huella SHA-256 es la
  misma de la última vez (o ya está en `documentos`), solo marca la
  revisión. Si el PDF cambió pero las tasas leídas son **las mismas** de la
  publicada (o de una que ya espera aprobación), tampoco crea nada: solo
  anota la huella nueva. Así no hay que aprobar lo que no cambió. Si es nuevo: lo sube a `documentos` (origen `robot`), lee la
  tasa del producto de la fuente y crea la tasa **por aprobar** unida al PDF. Nunca
  publica: siempre se aprueba en `/admin/tasas`.
- **Un banco, varios productos:** cada fuente es un banco y un producto. La
  regla de libre inversión es `REGLAS["bbva"]` y la de libranza
  `REGLAS["bbva:libranza"]` (`reglaDe(banco, producto)`). Si los dos salen
  del mismo PDF, la de libranza copia cómo se busca y solo cambia `leer`; la
  huella se revisa **por fuente** (el PDF puede ser nuevo para libranza
  aunque ya esté guardado para libre inversión) y el archivo se sube **una
  sola vez** (el documento de libranza usa el mismo archivo).
- **Reglas por banco** (texto de `pdftotext -layout`):

| Banco           | Dónde está el PDF                                                               | Qué lee                                                                    |
| --------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| BBVA            | Dirección fija (`DO-01-Tasas-creditos-consumo.pdf`); cambia el contenido        | Tabla "Libre Inversión", fila "Todos": mínima y máxima                     |
| Banco de Bogotá | `/documents/d/guest/tasas-<mes>-<año>` del mes actual; si no está, el de antes  | Filas "Libre Destino … (Desde)": la más baja; hasta = usura                |
| Bancolombia     | Enlace `Actualizacion_tasas_<Mes>_<Año>.pdf` más nuevo del tarifario (índice)   | "…para los créditos de Libre Inversión": desde y hasta, M.V. y E.A.        |
| Davivienda      | Dirección fija `/documents/d/guest/tasas-tarifas-davivienda` (**bloquea**)      | "CrediExpress Fijo - Tradicional", fila "Libre Inversión"; hasta = usura   |
| Banco Popular   | **No publica PDF**: tabla en su página de tasas (fuente de tipo `pagina`)       | "Préstamo Personal de Libre Destino E.A.": desde y hasta (solo E.A.; M.V. calculada) |
| Banco Falabella | PDF mensual en Contentful (`assets.ctfassets.net/…/02-VERTICAL-TASAS-OCT-2026.pdf`); su página `/tasas-tarifas` **bloquea** al servidor | Tabla "Crédito de Libre Inversión": desde y hasta, M.V. y E.A.; vigencia "01 al 31 de …" |
| Davibank        | Enlace `Tasas-y-productos-credito…pdf` en `davibank.com/tasas-y-tarifas` (antes Scotiabank Colpatria) | "Consumo Libre Inversión", fila "Corriente desde": E.A. desde y hasta (M.V. calculada); vigencia "mes de … (del día 1 al día 31)" |
| Banco de Occidente | Dirección fija `/documents/d/guest/tasas-personas-bdo` (índice `/tarifas`)      | "Cupo línea Préstamo Personal", columna LIBRE INVERSIÓN: desde y hasta, M.V. y E.A. |
| Banco Caja Social | Dirección fija `…/credito-consumo/Tasas-Credito-Libre-Destino.pdf` (índice `/informacion-corporativa/tasas-precios-y-comisiones/`) | Fila "Libre Inversión": E.A. y M.V. desde y hasta; vigencia "18-Jun-2026" (no mensual) |
| Lulo Bank       | **No publica PDF**: página legal `/legals/doc-tasas-tarifas-credito` (fuente `pagina`). Se arma con JavaScript y **no le muestra las tasas al servidor** (ni con Chromium): recordatorio de los lunes | "Desde … M.V - … EA hasta … M.V - … EA"; vigencia "vigentes desde el …" |
| Bancoomeva      | "Cartelera Crediticia" mensual: el `descargar.php?idFile=<n>` con el número más alto en `/publicaciones/164289/tasas-de-credito/` | Página "Aplica para Clientes Bancoomeva" (no la de asociados): "Libre Inversión … Tasa desde % E.A"; hasta = usura |
| Banco Serfinanza | `TASAS-1-DE-<MES>-DE-<AÑO>.pdf` más nuevo en `/servicio-al-cliente/tasas/` | Tabla "Libre Inversión" (no la de libranza): tasa fija por monto; desde = la más baja, hasta = la más alta |
| Banco Finandina | `…/historial tasas y tarifas/tasas/tasas-<mes>-<año>.pdf` del mes actual (o el de la fuente; también la página de historial). **Y su página de tasas vigentes**, que se actualiza antes | "Préstamo para libre inversión Desde … NMV - Equivalente al … EA"; hasta = usura |
| Banco Agrario   | PDF **semanal** `Tasas_colocaciones_del_<d><mes>_al_<d><mes>_<año>.pdf`: el que empieza más tarde | Página "Creditos de Consumo" (recursos propios): desde = "PERSONAL - LIBRE DESTINO", hasta = "CREDITO DIGITAL LIBRE INVERSIÓN"; vigencia "DEL … AL … DE …" de esa sección |
| AV Villas       | Dirección de la fuente; si tiene `url_indice`, el "Tasas Activas" más nuevo     | "TASAS CONSUMO LIBRE INVERSIÓN": "Desde … ( … M.V. )" y "Hasta …"          |

- **Reglas de libranza** (`<banco>:libranza`). Desde = la tasa fija más
  baja de la tabla de libranza (de todas las pagadurías y plazos); hasta = la
  más alta si el banco la publica, si no la usura. Los convenios especiales
  (Policía, Ministerio de Defensa, Grupo Olímpica) no cuentan.

| Banco           | PDF                                         | Qué lee (oct 2026)                                                          |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| BBVA            | **Aparte**: `…/libranzas/DO-01-tasas-libranza.pdf` (dirección fija) | "Crédito de Libranza", tasas desde por segmento: 13,14 % E.A. (pensionados) |
| Banco de Bogotá | El mismo                                    | Tablas "LIBRANZAS … (Desde)" por pagaduría y plazo: 16,70 % E.A.            |
| Davivienda      | El mismo (se carga a mano)                  | Página "Créditos de Libranza", CrediExpress Fijo Libranza: 16,76 % E.A.     |
| AV Villas       | El mismo                                    | "Créditos de Consumo", fila LIBRANZA: 16,15 % a 28,59 % E.A.                |
| Bancolombia     | El mismo                                    | "…para las Libranzas", tasa fija de empleados y Fopep: 14,30 % a 28,57 %    |
| Banco Agrario   | El mismo (semanal)                          | Tabla "Credito de Libranza" (sin convenios especiales): 19,30 % a 25,60 %   |
| Serfinanza      | El mismo                                    | "Libranza Libre Inversión" sin Grupo Olímpica: 18,02 % a 19,42 % E.A.       |
| Finandina       | El mismo y su página de tasas vigentes      | Fila "Libranza Desde … NMV": 21,27 % E.A.                                   |
| Bancoomeva      | La misma cartelera                          | Clientes, fila "Libre Inversion" de LIBRANZA: 23,58 % E.A.                  |

  Faltan (no la traen en el PDF que se baja): Popular, Occidente, Caja
  Social, y los nuevos Pichincha, GNB Sudameris, Bancien y Banco Unión.

- **Bancos sin PDF** (regla con `pagina: true`, hoy Banco Popular): el robot
  lee la tabla del HTML de su página (sin navegador). Como la página cambia
  en cada visita, la huella es la de **la tasa leída**, no la de la página.
  Si cambió, toma un **pantallazo de la tabla** con Chromium (Playwright,
  instalado en el Dockerfile) y lo guarda en `documentos` como prueba, en
  lugar del PDF. En la web el enlace dice "Tasas en la página del banco".
- **PDF mensual con índice bloqueado** (regla con `mensual: true`, hoy
  Falabella): el robot revisa a diario el PDF guardado (el servidor de
  archivos sí deja bajarlo), pero no puede encontrar el del mes siguiente
  porque la página que lo enlaza responde 403. Desde el día 2 de cada mes, si
  la última tasa guardada es de un mes anterior, el recordatorio sale **todos
  los días** hasta que se sube el PDF nuevo en `/admin/tasas` (Davivienda, que no
  deja ver nada, sigue saliendo solo los lunes).
- **PDF o página de tasas vigentes** (regla con `paginaVigente`, hoy
  Finandina): el robot lee los dos. Se prefiere el **PDF**; si la página
  rige desde una fecha más nueva (el PDF del mes aún no sale), usa la
  **página** con pantallazo. Cuando sale el PDF de esa fecha con las mismas
  tasas, crea igual la tasa por aprobar para que la prueba quede con el PDF
  oficial. Cada tasa guarda de dónde salió (`enlace` y `enlace_es_pagina` en
  `tasas_publicadas`), y la web enlaza ahí.
- **Reservados para libranza** (inactivos en `entidades`, 26 oct 2026): **GNB
  Sudameris** (1-12) no publica tasa de libre inversión; su PDF fijo
  `/ws/documentos?d=TASAS` trae libranza 24,60 % E.A. (fuente de libranza
  pausada, id 22). **Banco Unión** (1-67) reporta 30 créditos de libre
  inversión en 4 semanas y presta sobre todo rotativo y libranza. No se
  toman tasas de comparadores (ComparaBien muestra a GNB en 23,14 % sin
  fuente oficial).
- **Revisa lo leído:** desde entre 5 % y la usura, hasta no mayor que la
  usura ni menor que la desde, M.V. y E.A. que cuadren entre sí y fecha de
  vigencia. Si algo falla, la tasa queda por aprobar **sin valores** y con
  la explicación en las notas.
- **Correo** (`comun/aviso.mjs`) cuando: no encuentra el PDF (dice qué
  direcciones probó y qué respondieron), la regla no lo lee (dice qué no
  encontró), lo leído no tiene sentido, o hay una tasa nueva por aprobar.
  El robot del promedio también avisa si falla, si un banco no reportó o si
  el promedio saltó más de 2 puntos.
- **Usura:** el "hasta" de los bancos que no publican máxima es la usura de
  `src/app/core/datos/usura.json` (la misma que usa la página). **Hay que
  actualizarla cada mes**; si no, el robot rechaza tasas por encima de la
  usura vieja.
- **Sin navegador:** pide el PDF como un navegador (sin Playwright). Si un
  banco lo bloquea, llega el correo de "no encontré el PDF" y se carga a
  mano en `/admin/tasas`.
- **Davivienda bloquea servidores** (prueba del 26 oct 2026 en el VPS: 403
  con Node, con `curl` y con Chromium de Playwright, incluso en su página de
  tasas). Su regla tiene `bloquea: true`: el robot lo intenta cada día y,
  los lunes, manda un **correo aparte de recordatorio** con cada banco que
  toca revisar a mano: enlace al PDF, página del banco y el último PDF
  guardado (desde cuándo rige y cuándo se subió). `--recordatorio` lo manda
  el día que sea.

### Cuando una regla se rompe

1. Bajar el PDF nuevo y probar la regla: `node robots/pdf-bancos.mjs
   --probar bbva archivo.pdf` (muestra lo leído y los problemas).
2. Ver el texto con `pdftotext -layout archivo.pdf -`, ajustar la regla en
   `reglas.mjs` y agregar el texto en `pruebas/textos/` si cambia la forma.
3. `cd robots && npm test` (las pruebas usan el texto de los PDF reales).

## Ponerlos a correr (Coolify)

1. **Usuario "Robot" en Directus** con una política que solo permita:
   leer `entidades`, `fuentes`, `documentos` y `tasas_publicadas`; crear en
   `tasas_publicadas` (solo `estado = por_revisar`), `documentos` y
   `directus_files`; actualizar en `fuentes` (`url`, `ultimo_hash`,
   `ultima_revision`); crear y actualizar `tasas_promedio`. Generar su token.
2. **Recurso nuevo en Coolify** desde este repo, rama `develop`, con
   Dockerfile `robots/Dockerfile` y contexto en la raíz. No expone puertos.
3. **Variables:** `DIRECTUS_TOKEN` (del Robot), `DIRECTUS_URL`
   (opcional), `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`,
   `AVISO_PARA` y `AVISO_DE` (opcional).
4. **Tareas programadas** (hora de Colombia):
   - `node pdf-bancos.mjs` todos los días a las 7:13 (`13 7 * * *`).
   - `node promedio-sfc.mjs` los martes a las 7:23 (`23 7 * * 2`).

## Probar en local

- `cd robots && npm install && npm test`
- `node robots/promedio-sfc.mjs --sin-guardar` (no necesita token)
- `DIRECTUS_TOKEN=… node robots/pdf-bancos.mjs --sin-guardar` (revisa sin
  escribir; necesita `pdftotext`)
