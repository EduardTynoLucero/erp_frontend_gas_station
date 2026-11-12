# syntax=docker/dockerfile:1
#
# Frontend del ERP Gas Station (Next.js 16, salida standalone) para producción. Se construye solo con esta carpeta.
# La URL del backend NO se fija al compilar: se lee de API_URL al arrancar (ver src/proxy.ts), así la misma imagen
# sirve con cualquier backend.
#
#   docker build -t erp-frontend .
#   docker run -e API_URL=http://erp-backend:4000 -p 3000:3000 erp-frontend
#
# En Dokploy: Build Type «Dockerfile», Dockerfile Path «Dockerfile», Docker Context Path «.»,
# Docker Build Stage «production» (o vacío: es la última etapa).

ARG NODE_VERSION=24

# ---------- 1. Dependencias ----------
FROM node:${NODE_VERSION}-alpine AS dependencias
# libc6-compat: algunos binarios nativos de Next.js la necesitan en Alpine (lo recomienda el ejemplo oficial)
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. Compilación ----------
FROM node:${NODE_VERSION}-alpine AS compilacion
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# public/ es opcional en Next.js: se asegura que exista para copiarla en la imagen final
RUN mkdir -p public && npm run build

# ---------- 3. Imagen final ----------
FROM node:${NODE_VERSION}-alpine AS production
# tini como PID 1 (la señal de parada llega a Node) y tzdata (las fechas del negocio son hora de Guatemala)
RUN apk add --no-cache tini tzdata
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=America/Guatemala \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Lo que pide la salida standalone: su server.js con los node_modules que usa, los estáticos y public/
COPY --from=compilacion --chown=node:node /app/public ./public
COPY --from=compilacion --chown=node:node /app/.next/standalone ./
COPY --from=compilacion --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
