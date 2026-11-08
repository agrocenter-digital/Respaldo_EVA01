# AgroCenter Digital — Stack local con Docker Compose

Levanta el ecosistema completo con un solo comando:

```bash
cp .env.example .env       # opcional: cambiar puertos, passwords o secreto JWT
docker compose up -d --build
```

## Servicios

| Servicio | URL local | Descripción |
| :--- | :--- | :--- |
| `front-web` | http://localhost:3000 | Frontend Next.js exportado estáticamente y servido con Nginx |
| `bff-web` | http://localhost:8080 | Backend For Frontend (Spring Boot) |
| `ms-inventario` | http://localhost:8081 | Catálogo, stock y movimientos |
| `ms-ventas` | http://localhost:8082 | Checkout e historial de ventas |
| `ms-compras` | http://localhost:8083 | Órdenes de compra y reabastecimiento |
| `db-inventario` | localhost:5434 | PostgreSQL 16 (`db_inventario`) |
| `db-ventas` | localhost:5435 | PostgreSQL 16 (`db_ventas`) |
| `db-compras` | localhost:5436 | PostgreSQL 16 (`db_compras`) |

## Flujo

```text
Navegador
   │  http://localhost:3000
   ▼
front-web (Nginx)
   │  /api/*  y  /actuator/*  (proxy same-origin)
   ▼
bff-web:8080
   ├── ms-inventario:8081 ── db-inventario
   ├── ms-ventas:8082     ── db-ventas
   └── ms-compras:8083    ── db-compras
```

El frontend se compila con `NEXT_PUBLIC_API_BASE_URL` vacío, por lo que usa rutas
relativas. Nginx se encarga del proxy hacia `bff-web` y se evita CORS.

## Autenticación local

Los servicios arrancan con el perfil Spring `dev`. El frontend usa una sesión
simulada de administrador (`ROLE_ADMIN`) y un JWT de desarrollo firmado con
`DEV_JWT_SECRET`.

> Este stack es solo para desarrollo/demostración. No usar el secreto ni el token
> embebido en producción.

Si cambias `DEV_JWT_SECRET` en `.env`, debes regenerar el token embebido en
`front-web/lib/cognito.ts` o el panel admin recibirá `401`.

## Verificación rápida

```bash
docker compose ps
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/bff/catalogo
curl -i http://localhost:3000/actuator/health
```

## Comandos útiles

```bash
# Logs de un servicio
docker compose logs -f bff-web

# Reconstruir solo el frontend
docker compose up -d --build front-web

# Detener sin borrar datos
docker compose down

# Detener y borrar bases de datos
docker compose down -v
```
