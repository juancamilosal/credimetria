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

| Ruta                 | Pantalla          | Qué hace                                                                                                                                        |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Inicio            | "Compara con datos, no con promesas": qué hacemos, las 3 tasas más bajas de libre inversión, cómo funciona, entidades y asesoría                |
| `/ranking`           | Ranking de tasas  | Lista completa por tasa real con filtros de producto y tipo de entidad (`?producto=…&tipo=…`)                                                   |
| `/compara-tu-oferta` | Compara tu oferta | Chat guiado (sin IA): la persona escribe lo que le ofrecieron y ve la tasa real, los costos dentro de la cuota y el ahorro; lleva a la asesoría |
| `/simulador`         | Simulador         | Cuota, total y ahorro frente a la mejor entidad, comparador de dos entidades y las 3 que menos cobran del producto elegido                      |
| `/asesoria`          | Asesoría          | Formulario de prospecto con validaciones y autorización de datos obligatoria                                                                    |
| `/aliados`           | Asesores aliados  | Lista pública de quienes pueden recibir los datos, compromisos y reporte                                                                        |
| `/politica-de-datos` | Política          | Borrador: el texto legal falta y debe estar antes de abrir el formulario                                                                        |

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
- El simulador y el ranking llevan a `/asesoria` con el producto, el monto,
  la entidad o la urgencia en la dirección, y el formulario llega lleno.
- Con los valores por defecto el simulador da $648.087, $604.529 y un ahorro
  de $2.090.784, como pide el documento (hay pruebas que lo revisan).
- Si la tasa escrita supera la usura del mes, el simulador lo avisa
  (`USURA_CONSUMO` en `core/datos/tasas.ts`; se actualiza cada mes).
- En celular: menú en botón de 44 px, ranking en tarjetas y chips de producto
  que se desplazan de lado. Revisado a 390 px sin desplazamiento horizontal.

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
- Sin diseñar: formulario "Quiero ser aliado" (por ahora es un correo) y la
  tabla de amortización.

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
