# Robots de Credimetría

Dónde busca cada robot y qué guarda en Directus
(`credimetria-api.valkiriacode.com`). Corren en el VPS como tareas
programadas de Coolify, con el token de un usuario "Robot" que solo puede
crear tasas por aprobar, actualizar fuentes y promedios, y subir archivos.

## 1. Robot del promedio (`promedio-sfc.mjs`) · listo

- **Fuente:** Superintendencia Financiera, formato 88, en datos.gov.co:
  conjunto `qzsc-9esp` ("Tasas de interés activas por tipo de crédito –
  últimos dos meses"). El histórico está en `w9zh-vetq`.
- **Cómo:** por entidad (`entidades.codigo_sfc`, tipo-código: Bogotá 1-1,
  Bancolombia 1-7, BBVA 1-13, Davivienda 1-39, AV Villas 1-49) y producto
  (`Libre inversión`), promedio ponderado por monto de las últimas 4
  semanas.
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

## 2. Robot de los PDF de los bancos · por hacer

Lee `fuentes` (tipo PDF, estado activa). Si el PDF cambió (huella
SHA-256 distinta), lo sube a `documentos` como nuevo y crea la tasa por
aprobar unida a él. Necesita un navegador real (Playwright): algunos bancos
bloquean la descarga desde un servidor. Cómo encontrar cada PDF (también en
`fuentes.patron`):

| Banco           | Dónde está el PDF                                                                         |
| --------------- | ----------------------------------------------------------------------------------------- |
| BBVA            | Dirección fija (`DO-01-Tasas-creditos-consumo.pdf`); cambia el contenido                  |
| Banco de Bogotá | Uno por mes: `/documents/d/guest/tasas-<mes>-<año>`; índice `tasas-y-tarifas/tasas-<año>` |
| Bancolombia     | Cambia cada mes: buscar `Actualizacion_tasas_<Mes>_<Año>.pdf` en el tarifario             |
| Davivienda      | Dirección fija `/documents/d/guest/tasas-tarifas-davivienda`; tabla "Créditos de Consumo" |
| AV Villas       | "Tasas Activas 01 <Mes> <Año>.pdf"; falta la página índice                                |

Reglas: la tasa se guarda como la publica el banco; si no publica máxima,
el "hasta" es la usura del mes (`hasta_origen = usura`). Ver el README
principal.
