# Credimetría

**Compara con datos, no con promesas.** Página web que compara la tasa que anuncian y la
tasa que de verdad cobran bancos, cooperativas y financieras en Colombia, y
conecta a la persona con un asesor de crédito aliado.

Hecha con Angular 20 (componentes independientes, señales, formularios
reactivos y SSR con prerenderizado).

## Ramas

- `develop`: aquí se trabaja.
- `main`: solo producción.

## Pantallas

Siguen el documento "Credimetría · Pantallas a desarrollar en Angular" y el
diseño "Credimetría · Marca y página web", con una paleta más sobria que la
morada y oro del diseño (ver abajo).

| Ruta                 | Pantalla          | Qué hace                                                                                                                                                            |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Inicio            | "Compara con datos, no con promesas": qué hacemos, las 3 tasas más bajas de libre inversión, cómo funciona, entidades y asesoría                                    |
| `/ranking`           | Ranking de tasas  | Tabla que se ordena y se filtra por tipo desde los títulos (como en Excel), con producto, monto y plazo arriba para calcular la cuota de todas                      |
| `/compara-tu-oferta` | Compara tu oferta | Chat guiado (sin IA): la persona escribe lo que le ofrecieron y ve la tasa real, los costos dentro de la cuota y el ahorro; lleva a la asesoría                     |
| `/simulador`         | Simulador         | Cuota, total, ahorro y tabla de amortización, comparador de dos entidades y las 3 que menos cobran del producto elegido                                             |
| `/asesoria`          | Asesoría          | Formulario corto de prospecto: crédito, monto opcional, ciudad, nombres, apellidos, celular y autorización de datos obligatoria                                     |
| `/aliados`           | Asesores aliados  | Lista pública de quienes pueden recibir los datos, compromisos y reporte                                                                                            |
| `/politica-de-datos` | Política          | Borrador: el texto legal falta y debe estar antes de abrir el formulario                                                                                            |
| `/admin/tasas`       | Configuración     | Solo administradores de Directus: revisar, publicar, rechazar, corregir y agregar tasas con su fecha y el enlace de la fuente                                       |
| `/admin/pdf`         | PDF de tasas      | Por banco y producto: el PDF actual, el nuevo por aceptar (manual o del robot) y los anteriores; cargar, usar como actual, descartar y agregar la dirección del PDF |

- **Ranking como en Excel** (`paginas/ranking/` y
  `compartido/tabla-ranking/`): cada título ordena la tabla al tocarlo (↑/↓,
  `aria-sort`) y el embudo del título "Tipo" filtra por tipo de entidad.
  Arriba se elige el producto y se escriben el monto y el plazo, y la cuota
  estimada de todas se recalcula al instante. El # siempre es el puesto por
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
- **Configuración** (`/admin/tasas`, con la guarda `soloAdmin`): lista de
  `tasas_publicadas` filtrable por estado (Por revisar, Publicadas,
  Rechazadas, Todas) y producto. Cada tasa muestra lo que publica la
  entidad, la E.A., la fecha de vigencia, cuándo se capturó, el enlace a la
  fuente (página o PDF, y la página de tasas y tarifas si la hay), la frase
  y las notas, con el logo de la entidad (de `entidades.logo`, pedido a
  Directus con el token en la dirección porque los archivos no son
  públicos), y el enlace a la copia guardada del PDF o la página
  (`captura`). "Subir copia del PDF" sube el archivo a Directus y lo une a
  la tasa. Se puede publicar, rechazar, volver a revisar, editar
  (con "Calcular E.A." desde la tasa mensual) y crear una tasa nueva desde
  una fuente. Al publicar o rechazar se guardan `revisada_por` y
  `revisada_en`.
- **PDF de tasas** (`/admin/pdf`): una tarjeta por banco y producto con el
  logo, los enlaces al PDF en el banco, la página de tasas y tarifas y la
  página del producto. A la izquierda el **PDF actual** y a la derecha el
  **PDF nuevo** (vigencia, cuándo y quién lo cargó, tamaño y "Abrir").
  "Cargar PDF" sube el archivo con su fecha de vigencia y lo deja como
  nuevo; si su huella SHA-256 ya existe, avisa y no lo sube. "Usar como
  actual" pasa el actual a anterior (nunca se borra) y "Descartar" quita un
  nuevo que no sirve. Si el banco no tiene fuente PDF, pide la dirección
  directa del PDF y, opcional, la página de tasas y tarifas que lo enlaza, y
  crea la fuente. "Editar direcciones" corrige las dos (la dirección del PDF
  debe abrir el PDF, no la página índice). Las dos pestañas comparten la cabecera
  `paginas/admin/cabecera/`.
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

### Colecciones en Directus

`credimetria-api.valkiriacode.com` (Directus 11):

- `entidades`: código (llave), nombre, razón social, NIT (único) y dígito de
  verificación, código SFC, tipo, sitio web, logo y activa.
- `fuentes`: entidad, producto, tipo (página o PDF), dirección, página
  índice de tasas y tarifas, cómo extraer, patrón, estado, última revisión,
  huella y notas.
- `documentos`: los PDF de tasas de cada fuente, con archivo, estado
  (nuevo, actual, anterior), vigencia, origen (manual o robot), huella
  SHA-256, notas, y quién y cuándo lo cargó.
- `tasas_publicadas`: historial (no se sobrescribe) con fuente, entidad,
  producto, valor desde y hasta, unidad (M.V., N.M.V., E.A.), E.A. desde y
  hasta, tipo de tasa, sistema de amortización, frase de la fuente,
  vigencia, captura, estado (por revisar, publicada, rechazada), quién y
  cuándo la revisó, y notas.

## Estructura

```
src/app/
  compartido/     encabezado, pie, logo, chips, tabla del ranking y pipes
                  (pesos: $20.000.000, tasa: 21,48 %, puntos: +7,38 pts)
  core/
    modelos/      tasa, prospecto y aliado
    datos/        tasas y aliados de ejemplo, usura del mes
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

- **Tasas y aliados son de ejemplo** (`ejemplo: true`); la página lo avisa.
  Solo AV Villas (21,48 %) y Banco de Bogotá (26,38 %) en libre inversión son
  las cifras del documento de la idea. En la Fase 1 los servicios leerán la
  base de datos; los componentes no cambian.
- **El formulario no envía datos todavía.** `ProspectosService` arma el
  prospecto con la prueba de la autorización (fecha, texto exacto, versión de
  la política y página de origen). Falta la API que lo guarde y agregue la IP.
- Antes de publicar el formulario: la política de tratamiento de datos real
  y los aliados reales en `/aliados`.
- Sin diseñar: formulario "Quiero ser aliado" (por ahora es un correo).

## Comandos

```bash
npm install
npm start                      # http://localhost:4200 (sin SSR)
npm run build                  # compila y prerenderiza las 7 rutas
npm run serve:ssr:credimetria  # sirve la compilación con SSR
npm test                       # pruebas con Karma
npx prettier --write "src/**/*.{ts,html,css}"
```

`npm start` (configuración `development`) corre **sin SSR**, solo en el
navegador. Con SSR en desarrollo, la primera carga en Windows a veces
respondía "Cannot GET /" porque el servidor de Vite aún no tenía listas las
rutas. El SSR y el prerenderizado se prueban con `npm run build` y
`npm run serve:ssr:credimetria` (http://localhost:4000).
