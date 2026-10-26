# Contenedor de los robots para Coolify. Se construye desde la raíz del repo:
#   docker build -f robots/Dockerfile .
# Queda encendido sin hacer nada; las tareas programadas de Coolify corren
# `node promedio-sfc.mjs` y `node pdf-bancos.mjs` dentro de él.
FROM node:22-slim

# pdftotext, para leer el texto de los PDF.
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY robots/package.json robots/package-lock.json robots/
RUN cd robots && npm ci --omit=dev
# Chromium de Playwright, para el pantallazo de los bancos que publican la
# tasa en su página y no en un PDF (Banco Popular).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN cd robots && npx playwright install --with-deps chromium
COPY robots/*.mjs robots/
COPY robots/comun robots/comun
# La usura del mes, la misma que usa la página.
COPY src/app/core/datos/usura.json src/app/core/datos/usura.json

WORKDIR /app/robots
CMD ["sleep", "infinity"]
