# Credimetría

**Compara con datos, no con promesas.** Página web que compara la tasa que anuncian y la
tasa que de verdad cobran bancos, cooperativas y financieras en Colombia, y
conecta a la persona con un asesor de crédito aliado.

Hecha con Angular 20 (componentes independientes, señales, formularios
reactivos y SSR: cada visita se arma en el servidor con las tasas de
Directus del momento).

## Ramas

- `develop`: aquí se trabaja.
- `main`: solo producción.

## Pantallas

Siguen el documento "Credimetría · Pantallas a desarrollar en Angular" y el
diseño "Credimetría · Marca y página web", con una paleta más sobria que la
morada y oro del diseño (ver abajo).

| Ruta                 | Pantalla          | Qué hace                                                                                                                                                              |
| -------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Inicio            | "Compara con datos, no con promesas": qué hacemos, las 3 tasas más bajas de libre inversión, cómo funciona, entidades y asesoría                                      |
| `/ranking`           | Ranking de tasas  | Tabla que se ordena y se filtra por tipo desde los títulos (como en Excel), con producto, monto y plazo arriba para calcular la cuota de todas                        |
| `/compara-tu-oferta` | Compara tu oferta | Chat guiado (sin IA): la persona escribe lo que le ofrecieron y ve la tasa real, los costos dentro de la cuota y el ahorro; lleva a la asesoría                       |
| `/simulador`         | Simulador         | Cuota, total, ahorro y tabla de amortización, comparador de dos entidades y las 3 que menos cobran del producto elegido                                               |
| `/asesoria`          | Asesoría          | Formulario corto de prospecto: crédito, monto opcional, ciudad, nombres, apellidos, celular y autorización de datos obligatoria                                       |
| `/aliados`           | Asesores aliados  | Lista pública de quienes pueden recibir los datos, compromisos y reporte                                                                                              |
| `/politica-de-datos` | Política          | Borrador: el texto legal falta y debe estar antes de abrir el formulario                                                                                              |
| `/admin/tasas`       | Configuración     | Solo administradores de Directus: por banco, la tasa publicada y la que espera aprobación, cada una con su PDF; comparar los PDF, editar, aprobar y cargar PDF nuevos |

- **Ranking como en Excel** (`paginas/ranking/` y
  `compartido/tabla-ranking/`): cada título ordena la tabla al tocarlo (↑/↓,
  `aria-sort`) y el embudo del título "Tipo" filtra por tipo de entidad.
  Arriba se elige el producto y se escriben el monto y el plazo, y la cuota
  estimada y el **pago total** (cuota redondeada × meses, con los intereses
  debajo; sin seguros ni cargos) de todas se recalculan al instante. El # siempre es el puesto por
  tasa real. En celular, donde no se ven los títulos, hay listas de "Ordenar
  por" y "Tipo de entidad". Todo queda en la dirección
  (`?producto=…&tipo=…&monto=…&plazo=…&orden=diferencia-desc`) y "Quiero
  esta" lleva el monto a la asesoría.
- **Compara tu oferta** (`paginas/compara-oferta/`): preguntas fijas con
  botones (producto, monto, plazo, qué le dijeron: tasa E.A., tasa mensual o
  solo la cuota). Convierte la tasa mensual a E.A., saca la tasa real de la
  cuota (`tasaDeCuota`, búsqueda binaria), muestra los costos dentro de la
  cuota, el ahorro frente a la mejor entidad y si supera la usura (de
  consumo; no aplica a vivienda). Al abrir muestra un ejemplo resuelto
  (20.000.000 a 48 meses, 26,38 % E.A., cuota 700.000 → 32,22 % E.A. y
  $51.913 al mes de costos). Nada se guarda ni se envía: si la persona quiere
  asesoría, va a `/asesoria` con `origen=oferta`, así la autorización de
  datos sigue en un solo formulario. El cálculo está en `oferta.ts`.
- **Comparar dos entidades** (`paginas/simulador/comparador/`): en
  `/simulador`, Entidad A y Entidad B del producto elegido con el monto y el
  plazo del simulador; muestra la cuota de cada una y cuánto se ahorra con la
  más barata (Banco de Bogotá contra AV Villas, $20.000.000 a 48 meses →
  $2.090.784). Usa la tasa que cada una cobra en promedio.
- **Asesoría corta** (`paginas/asesoria/`): una sola pantalla con lo mínimo
  para que el asesor contacte a la persona: qué crédito le interesa, monto
  (opcional, con botones de $5, $10, $20 y $50 millones u "Otro monto"),
  ciudad (botones con las principales y "Otra"), el bloque "Tus datos de
  contacto" (nombres, apellidos, número de celular y canal) y la
  autorización. Ingresos, reportes y demás los pregunta el asesor. La
  urgencia solo se guarda si llega en el enlace (inicio o Compara tu oferta).
- **Simular y tabla de amortización** (`paginas/simulador/calculadora/`):
  el botón "Simular" muestra debajo la tabla mes a mes (cuota, intereses,
  abono a capital y saldo, que cierra en $0) con el total de intereses y el
  total a pagar; luego sigue los cambios de monto, plazo y tasa. Con los
  valores por defecto: $11.108.167 en intereses y $31.108.167 en total. En
  celular se quita la columna de cuota (es fija y está arriba). El cálculo
  es `amortizacion()` en `core/utilidades/credito.ts`.
- **Tipo de cuota** (simulador): una sola casilla "Cuota fija", sin marcar.
  Sin marcar, el simulador usa cuota decreciente (abono constante a
  capital); marcada, cuota fija (sistema francés). El botón "?" abre un
  globo (`role="tooltip"`) que lo explica; se abre al pasar el mouse, con el
  teclado o tocándolo en el celular. Con cuota decreciente el resultado
  muestra la primera y la última cuota, y el ahorro frente a la mejor
  entidad se calcula con el mismo sistema ($20.000.000 a 48 meses con
  26,38 %: de $810.703 a $424.876 y $9.653.893 en intereses, frente a
  $11.108.167 con cuota fija). El comparador de dos entidades sigue con
  cuota fija.
- **Montos con puntos al escribir** (`compartido/entrada-moneda/`): la
  directiva `appMoneda` pone los puntos de miles mientras la persona teclea
  (1000000 → 1.000.000) y usa la coma para los centavos, con máximo dos
  (1.000.000,5 → 1.000.000,50 al salir del campo). Un punto tecleado se toma
  como la coma, porque hay teclados de celular que solo traen punto. Está en
  los montos del ranking, el simulador, la asesoría y el chat de Compara tu
  oferta (no en las tasas).
- El simulador y el ranking llevan a `/asesoria` con el producto, el monto,
  la entidad o la urgencia en la dirección, y el formulario llega lleno.
- Con "Cuota fija" marcada, el simulador da $648.087, $604.529 y un ahorro
  de $2.090.784, como pide el documento (hay pruebas que lo revisan). Por
  defecto, con cuota decreciente, da $810.703 la primera cuota y $1.643.800
  de ahorro.
- Si la tasa escrita supera la usura del mes, el simulador lo avisa
  (`USURA_CONSUMO` en `core/datos/tasas.ts`; se actualiza cada mes).
- En celular: menú en botón de 44 px, ranking en tarjetas y chips de producto
  que se desplazan de lado. Revisado a 390 px sin desplazamiento horizontal.

## Configuración de tasas (`/admin`)

Pantalla para revisar las tasas que publican las entidades sin entrar a
Directus. No está en el menú: se entra por `/admin`.

- **Entrar** (`/admin/entrar`): correo y contraseña de Directus. Solo pasan
  las cuentas con acceso de administrador (`admin_access` en sus
  políticas). El token de acceso queda en memoria y el de renovación en
  `sessionStorage`: recargar no cierra la sesión, cerrar la pestaña sí.
- **Configuración de tasas** (`/admin/tasas`, con la guarda `soloAdmin`):
  todo en una pantalla. Una tarjeta por banco y producto, con su logo (de
  `entidades.logo`, pedido a Directus con el token en la dirección porque
  los archivos no son públicos) y los enlaces al PDF en el banco, la página
  de tasas y tarifas y la página del producto ("Editar direcciones" o
  "Agregar dirección del PDF"; la dirección debe abrir el PDF, no la página
  índice). Dos columnas:
  - **Publicada hoy**: la tasa que sale en la página, con su PDF (`Abrir`).
  - **Por aprobar**: la tasa nueva con su PDF, lo que cambia frente a la
    publicada (mín. ▲ +1,05 pts) y los botones **Aprobar**, **Rechazar**,
    **Editar** (con "Calcular E.A." y el PDF de donde sale) y **Comparar
    PDF**, que muestra el PDF actual y el nuevo lado a lado (se bajan con
    el token y se ven como blob dentro de la página). **Cargar PDF nuevo**
    sube el PDF con su vigencia (si su huella SHA-256 ya existe, avisa) y
    crea la tasa por aprobar unida a él, lista para escribir los valores.
  - La **tasa publicada** se puede corregir si se aprobó por error:
    **Editar** sus valores (si cambia la vigencia, también cambia la de su
    PDF), **Cambiar archivo** sube el PDF correcto en lugar del equivocado
    (borra el anterior; avisa si ya existe en otro registro) y **Eliminar
    tasa y PDF** (con un segundo toque) borra las dos; si había una tasa
    anterior, vuelve a quedar publicada con su PDF como actual. Por aprobar
    se corrige con Editar o se rechaza.
  - La frase del PDF, las notas y quién aprobó van ocultas en **"Ver más
    detalle"**, para que la tarjeta muestre solo lo principal.
  - **Aprobar** deja la tasa publicada y su PDF como actual; la tasa que
    estaba publicada y el PDF anterior pasan a `anterior`. Nada se borra:
    "Ver anteriores" muestra las anteriores y rechazadas con su PDF.
  - Filtros: todos los bancos o solo los que tienen algo por aprobar, y
    producto. La cabecera con "Salir" está en `paginas/admin/cabecera/`.
  - `/admin/pdf` (la pestaña que hubo antes) lleva a esta pantalla.
- Estas rutas no se prerenderizan (`RenderMode.Client`) y llevan
  `noindex`. La dirección de Directus está en `core/config/directus.ts`.
- **Directus debe permitir CORS** para el dominio de la página. En las
  variables del servicio (Coolify): `CORS_ENABLED=true` y
  `CORS_ORIGIN=http://localhost:4200,https://<dominio de Credimetría>`.
  Sin eso, el navegador no puede entrar y la pantalla dice que no pudo
  conectar.

### De dónde sale la tasa publicada

Decisión del 25 oct 2026: la tasa que publica cada entidad se toma de su
**PDF oficial de tasas y tarifas vigente**, con la fecha de vigencia del
documento. La página web del producto solo sirve para encontrar el PDF: al
compararlas, las páginas mostraban otras tasas (BBVA, libre inversión:
desde 0,85 % M.V. en datos ocultos de la página contra 1,77 % a 2,12 %
M.V. en el PDF vigente desde el 5 oct 2026). Cada tasa guarda la copia del
PDF en `captura`. Algunas entidades bloquean la descarga automática, así
que el robot debe bajar los PDF con un navegador real.

**El rango siempre lleva desde y hasta** (regla del 25 oct 2026): se
guarda lo que publica la entidad. Si no publica máxima, el "hasta" es la
**tasa de usura del mes** (tope legal; `hasta_origen = usura`) y la
pantalla lo aclara ("Máxima: tope de usura, el banco no la publica").
Si publica por segmentos (Personas, Preferente, Premium…), "desde" es la
más baja y los segmentos van en las notas. Ejemplo: Banco de Bogotá, libre
inversión, desde 1,13 % (Premium e Insigne; Personas desde 1,85 %) hasta
2,118 % M.V. por usura. En la edición, "Usar tope de usura" llena el hasta
con `USURA_CONSUMO` (no se ofrece en vivienda).

### Colecciones en Directus

`credimetria-api.valkiriacode.com` (Directus 11):

- `entidades`: código (llave), nombre, razón social, NIT (único) y dígito de
  verificación, código SFC, tipo, sitio web, logo y activa.
- `fuentes`: entidad, producto, tipo (página o PDF), dirección, página
  índice de tasas y tarifas, cómo extraer, patrón, estado, última revisión,
  huella y notas.
- `tasas_promedio`: lo que cobra cada entidad en promedio según la
  Superfinanciera (formato 88, datos.gov.co conjunto `qzsc-9esp`): una
  fila por entidad y producto con la tasa E.A. (promedio ponderado por
  monto de 4 semanas), la fecha de corte, cuándo se actualizó, si está al
  día o sin reporte, el CSV de respaldo (`respaldo`) y el enlace de la
  consulta (`consulta_url`). La sobrescribe el robot del promedio cada
  semana (sin historial, sin aprobación). Con ella se calcula la cuota, el
  ahorro y el orden del ranking; el rango del PDF va al lado. Las entidades
  se unen por `entidades.codigo_sfc` (tipo-código, ej. BBVA 1-13).
- `documentos`: los PDF de tasas de cada fuente, con archivo, estado
  (nuevo, actual, anterior), vigencia, origen (manual o robot), huella
  SHA-256, notas, y quién y cuándo lo cargó.
- `tasas_publicadas`: historial (no se sobrescribe) con fuente, entidad,
  producto, el PDF de donde salió (`documento`), valor desde y hasta,
  unidad (M.V., N.M.V., E.A.), E.A. desde y hasta, tipo de tasa, sistema de
  amortización, frase del PDF, vigencia, estado (por revisar, publicada,
  rechazada, anterior), quién y cuándo la revisó, y notas. `captura` queda
  de casos anteriores a `documento`.

## Robots

En `robots/` (ver `robots/README.md`): dónde busca cada robot y qué guarda.
`robots/promedio-sfc.mjs` actualiza `tasas_promedio` desde la
Superfinanciera (`--sin-guardar` para solo verlo). El robot de los PDF de
los bancos está por hacer.

## Estructura

```
src/app/
  compartido/     encabezado, pie, logo, chips, tabla del ranking y pipes
                  (pesos: $20.000.000, tasa: 21,48 %, puntos: +7,38 pts)
  core/
    modelos/      tasa, prospecto y aliado
    datos/        productos, usura del mes, aliados de ejemplo y tasas
                  solo para las pruebas
    servicios/    TasasService, AliadosService, ProspectosService
    utilidades/   cálculos de crédito (tasa mensual, cuota, ahorro, tasa
                  efectiva de una tasa mensual y tasa de una cuota)
  paginas/        inicio, ranking, simulador, compara-oferta, asesoria,
                  aliados y
                  politica-datos
```

Los colores, fuentes, radios y espacios están como variables `--cm-*` en
`src/styles.css`. La página arranca en modo claro; el botón de luna o sol
del encabezado cambia a oscuro (`TemaService`, guardado en el navegador y
aplicado antes de pintar desde `index.html` para que no parpadee). Ningún componente escribe
colores a mano. La paleta es sobria a propósito:

- **Base blanca y gris neutro**, con el encabezado y las cabeceras en blanco.
- **Azul profundo (`--cm-marca-*`)** como único color de marca: logo, botones
  principales, enlaces y el bloque oscuro de asesoría, la única zona de color
  fuerte de la página.
- **Verde (`--cm-ahorro-*`)** solo para el ahorro, la mejor tasa y
  "Verificado".
- **Ámbar (`--cm-aviso-*`)** solo para avisos: datos de ejemplo, diferencia
  entre la tasa anunciada y la cobrada.
- Fuentes: Plus Jakarta Sans para el texto e IBM Plex Mono para las cifras.

## Fotos

Las fotos de la marca (generadas con Gemini) tienen los originales en
`src/assets/`, con nombres que dicen qué muestran. La página usa versiones en
WebP de 640 y 1280 px en `public/imagenes/` (de 13 a 100 KB cada una),
mostradas con el componente `app-foto` y descritas en `core/datos/fotos.ts`.

| Foto                          | Dónde                               |
| ----------------------------- | ----------------------------------- |
| `celular-grafica-tasas`       | Portada del inicio                  |
| `hombre-revisa-cuentas`       | Tarjeta de libre inversión (inicio) |
| `docente-celular-salon`       | Tarjeta de libranza (inicio)        |
| `joven-carro-nuevo`           | Tarjeta de vehículo (inicio)        |
| `familia-vivienda-nueva`      | Tarjeta de vivienda (inicio)        |
| `pareja-pensionados-tablet`   | Bloque de asesoría gratis (inicio)  |
| `mujer-revisa-oferta-credito` | Cabecera del simulador              |

Para agregar una foto: el original en `src/assets/`, las dos versiones WebP
en `public/imagenes/` y su entrada en `FOTOS`.

## Datos de ejemplo y pendientes

- **Fuente del promedio a la vista**: el inicio y el ranking enlazan el
  conjunto de la Superfinanciera en datos.gov.co (`FUENTE_PROMEDIO` en
  `core/datos/tasas.ts`) de donde sale "Cobra en promedio". Las tarjetas del
  inicio muestran también "Pagarías en total" y los intereses.
- **Bancos con logo**: en el ranking (tabla y tarjetas del celular) y en el
  inicio se muestra solo el logo, porque ya trae el nombre; el nombre queda
  para lectores de pantalla (`visualmente-oculto`). Si una entidad no tiene
  logo, se muestra el nombre. Por eso conviene subir logos que digan el
  nombre del banco.
- **Las tasas vienen de Directus** (desde el 25 oct 2026, 5 bancos de
  prueba en libre inversión: AV Villas, Bancolombia, BBVA, Banco de Bogotá y
  Davivienda). `TasasService.cargar()` corre al arrancar
  (`provideAppInitializer`) y une la tasa publicada del PDF (rango, vigencia,
  enlace al PDF, logo) con el promedio de la Superfinanciera; la cuota y el
  orden usan el promedio. Los productos sin tasas muestran "Pronto". Los
  datos de ejemplo quedan solo para las pruebas (`core/datos/tasas-prueba.ts`,
  con `TASAS_DE_PRUEBA`). **Los aliados siguen siendo de ejemplo.**
- **Directus no es público.** Las tasas pasan por el servidor de la página
  (`servidor/tasas.mjs`): `/api/tasas` (JSON solo con lo que se muestra) y
  `/api/logos/<entidad>`, con el token del usuario **"Lector web"** de
  Directus (política de solo lectura: tasas publicadas, promedios,
  entidades activas, dirección del PDF y logos). Guarda la respuesta 10
  minutos y, si Directus falla, sigue con la última. Al armar la página en
  el servidor, las tasas van dentro de ella (`TransferState`): el navegador
  no las vuelve a pedir y nunca ve Directus ni el token.
- **Variables del servidor** (Coolify): `DIRECTUS_TOKEN` (token del "Lector
  web", obligatorio) y `DIRECTUS_URL` (opcional). Sin el token, la página
  sale sin tasas.
- **El formulario no envía datos todavía.** `ProspectosService` arma el
  prospecto con la prueba de la autorización (fecha, texto exacto, versión de
  la política y página de origen). Falta la API que lo guarde y agregue la IP.
- Antes de publicar el formulario: la política de tratamiento de datos real
  y los aliados reales en `/aliados`.
- **Para abrir vivienda u otra línea:** si un mismo PDF trae varios
  productos (Banco de Bogotá, AV Villas), cambiar en `fuentes` el campo
  `producto` por una lista `productos`, para subir el PDF una vez y sacar
  de él una tasa por producto. Vivienda necesita además `modalidad` (pesos
  o UVR); VIS / No VIS y plazos en las notas; la usura de consumo no aplica.
- Sin diseñar: formulario "Quiero ser aliado" (por ahora es un correo).

## Comandos

```bash
npm install
npm start                      # http://localhost:4200 (sin SSR) + API de tasas
npm run build                  # compila (sin prerenderizar: las tasas cambian)
npm run serve:ssr:credimetria  # sirve la compilación con SSR
npm test                       # pruebas con Karma
npx prettier --write "src/**/*.{ts,html,css}"
```

`npm start` levanta la API de tasas (`servidor/dev-api.mjs`, puerto 4300)
y el servidor de Angular, que le reenvía `/api` (`proxy.conf.json`). El
token va en un archivo `.env` (copia `.env.example`; no se sube al
repositorio).

`npm start` (configuración `development`) corre **sin SSR**, solo en el
navegador. Con SSR en desarrollo, la primera carga en Windows a veces
respondía "Cannot GET /" porque el servidor de Vite aún no tenía listas las
rutas. El SSR se prueba con `npm run build` y
`npm run serve:ssr:credimetria` (http://localhost:4000).

En producción, el servidor solo arma páginas para los dominios permitidos
(`allowedHosts` en `src/server.ts`: localhost, credimetria.co y
\*.valkiriacode.com); otro dominio se agrega con la variable
`NG_ALLOWED_HOSTS`. `DIRECTUS_URL` cambia, en el servidor, de qué Directus se
leen las tasas.
