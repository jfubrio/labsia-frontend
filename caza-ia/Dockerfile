# CAZA IA: una imagen, tres procesos (api, worker, migraciones) elegidos por el comando.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
# Por defecto la API; docker-compose elige el comando por servicio.
CMD ["npx", "tsx", "src/scripts/api-server.ts"]
