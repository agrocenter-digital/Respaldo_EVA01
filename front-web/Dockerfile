# ==========================================
# Etapa 1: Build estático de Next.js
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Se inyectan en build-time. Vacío => llamadas relativas (/api/...) y Nginx las proxya al BFF.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_COGNITO_DOMAIN=""
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID=""
ARG NEXT_PUBLIC_COGNITO_REDIRECT_URI=""

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN \
    NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID \
    NEXT_PUBLIC_COGNITO_REDIRECT_URI=$NEXT_PUBLIC_COGNITO_REDIRECT_URI \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ==========================================
# Etapa 2: Servidor estático Nginx
# ==========================================
FROM nginx:alpine AS runner

LABEL org.opencontainers.image.title="AgroCenter front-web" \
      org.opencontainers.image.description="Frontend estático de AgroCenter Digital servido con Nginx" \
      org.opencontainers.image.vendor="AgroCenter"

# Instalar utilidades de red para diagnóstico y validación en EC2 (curl, nslookup, etc.)
RUN apk add --no-cache curl bind-tools

COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
