# Credimetría

**Mide antes de prestar.** Aplicación web que compara la tasa que anuncian y
la tasa que de verdad cobran bancos, cooperativas y financieras en Colombia.

Hecha con Angular 20 (componentes independientes, señales y SSR con
prerenderizado).

## Ramas

- `develop`: aquí se trabaja.
- `main`: solo producción.

## Página de inicio

La ruta `/` (`src/app/paginas/inicio/`) tiene estas secciones:

1. **Portada:** qué es Credimetría, con un ejemplo de la brecha entre la tasa
   anunciada y la que se cobra (la entidad con la mayor diferencia en libre
   inversión).
2. **Mejores tasas** (`mejores-tasas/`): las 3 entidades con la tasa real más
   baja, con pestañas por tipo de crédito (libre inversión, libranza, vehículo
   y vivienda). Cada tarjeta muestra la cuota de ejemplo y el ahorro frente al
   promedio del mercado.
3. **Qué es Credimetría:** lo que ya hace la página y lo que viene pronto.
4. **Cómo funciona:** de los reportes de la Superfinanciera a la decisión.
5. **Simulador** (`simulador/`): cuota fija, intereses y total a pagar con el
   monto, el plazo y la tasa E.A. que escriba la persona.
6. **Nuestra regla:** el ranking siempre se ordena por tasa real.

## Estructura

```
src/app/
  compartido/   encabezado, pie y logo
  core/
    modelos/      tipos (TasaEntidad, Producto…)
    datos/        tasas de ejemplo (tasas.ts)
    servicios/    TasasService: mejores tasas, promedio, mayor brecha
    utilidades/   cálculos de crédito (tasa mensual, cuota, resumen)
  paginas/inicio/ página de inicio con sus bloques
```

Los colores y las fuentes (Bricolage Grotesque, IBM Plex Sans e IBM Plex
Mono) son los del documento de la idea. Están como variables en
`src/styles.css`, con modo oscuro automático.

## Datos

Por ahora las tasas son **de ejemplo** (`src/app/core/datos/tasas.ts`, con
`ejemplo: true`), y la página lo avisa debajo del ranking. En la Fase 1 el
recolector de datos.gov.co llenará la base de datos y `TasasService` leerá de
ahí. Los componentes no cambian, porque todo pasa por el servicio.

## Comandos

```bash
npm install
npm start                      # http://localhost:4200
npm run build                  # compila y prerenderiza
npm run serve:ssr:credimetria  # sirve la compilación con SSR
npm test                       # pruebas con Karma
npx prettier --write "src/**/*.{ts,html,css}"
```
