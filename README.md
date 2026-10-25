# Credimetría

**Mide antes de prestar.** Página web que compara la tasa que anuncian y la
tasa que de verdad cobran bancos, cooperativas y financieras en Colombia, y
conecta a la persona con un asesor de crédito aliado.

Hecha con Angular 20 (componentes independientes, señales, formularios
reactivos y SSR con prerenderizado).

## Ramas

- `develop`: aquí se trabaja.
- `main`: solo producción.

## Pantallas

Siguen el documento "Credimetría · Pantallas a desarrollar en Angular" y el
diseño "Credimetría · Marca y página web".

| Ruta                 | Pantalla         | Qué hace                                                                                               |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                  | Inicio           | Simulador (cuota, total y ahorro frente a la mejor entidad), las 3 mejores tasas, cómo funciona y urgencia |
| `/ranking`           | Ranking de tasas | Lista completa por tasa real con filtros de producto y tipo de entidad (`?producto=…&tipo=…`)           |
| `/asesoria`          | Asesoría         | Formulario de prospecto con validaciones y autorización de datos obligatoria                            |
| `/aliados`           | Asesores aliados | Lista pública de quienes pueden recibir los datos, compromisos y reporte                                |
| `/politica-de-datos` | Política         | Borrador: el texto legal falta y debe estar antes de abrir el formulario                               |

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
    utilidades/   cálculos de crédito (tasa mensual, cuota, ahorro)
  paginas/        inicio (con el simulador), ranking, asesoria, aliados y
                  politica-datos
```

Los colores, fuentes, radios y espacios del sistema de diseño (morado uva y
oro, Plus Jakarta Sans e IBM Plex Mono) están como variables `--cm-*` en
`src/styles.css`, con modo oscuro automático. Ningún componente escribe
colores a mano.

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
npm start                      # http://localhost:4200
npm run build                  # compila y prerenderiza las 5 rutas
npm run serve:ssr:credimetria  # sirve la compilación con SSR
npm test                       # pruebas con Karma
npx prettier --write "src/**/*.{ts,html,css}"
```
