# Página de Credimetría para Coolify (Build Pack: Dockerfile). Se construye
# desde la raíz del repo. Instala `pdftotext` (poppler-utils), que usa
# /api/admin/leer para leer los PDF cargados a mano en /admin/tasas con las
# reglas del robot.

# 1. Construir la página (Angular con su servidor).
FROM node:22-slim AS construir
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Solo lo construido: el servidor ya trae dentro lo que necesita.
FROM node:22-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=construir /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/credimetria/server/server.mjs"]
