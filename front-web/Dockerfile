# ==========================================
# Etapa 1: Dependencias
# ==========================================
FROM node:22-alpine AS deps
WORKDIR /app

# Copiar definiciones de paquetes
COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# Etapa 2: Construcción (Build)
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos de construcción para inyectar variables en el cliente durante el build
ARG NEXT_PUBLIC_COGNITO_DOMAIN
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_COGNITO_REDIRECT_URI
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN \
    NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID \
    NEXT_PUBLIC_COGNITO_REDIRECT_URI=$NEXT_PUBLIC_COGNITO_REDIRECT_URI \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ==========================================
# Etapa 3: Imagen final de ejecución
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

# Crear usuario y grupo de seguridad sin privilegios
RUN addgroup -S agrocenter && adduser -S agrocenter -G agrocenter

LABEL org.opencontainers.image.title="AgroCenter front-web" \
      org.opencontainers.image.description="Frontend web de AgroCenter Digital" \
      org.opencontainers.image.vendor="AgroCenter"

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Copiar artefactos construidos de Next.js y dependencias
COPY --from=builder --chown=agrocenter:agrocenter /app/.next ./.next
COPY --from=builder --chown=agrocenter:agrocenter /app/public ./public
COPY --from=builder --chown=agrocenter:agrocenter /app/node_modules ./node_modules
COPY --from=builder --chown=agrocenter:agrocenter /app/package.json ./package.json

USER agrocenter

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["npm", "run", "start"]