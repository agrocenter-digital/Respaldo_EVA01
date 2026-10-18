# AgroCenter Digital - ms-inventario

Microservicio responsable del catálogo, las existencias y la trazabilidad de inventario de **AgroCenter Digital**. Diseñado siguiendo el patrón **Database-per-Service** (conectado exclusivamente a `db_inventario`).

---

## 1. Arquitectura y Enrutamiento en AWS

En el entorno de producción (AWS Academy Learner Lab / ECS Fargate):
* **Puerto**: `8081`
* **Target Group**: `tg-ms-inventario` (Healthy)
* **Router de Microservicios**: Application Load Balancer interno (`internal-agrocenter-bff-alb:8080`).
* **Path-Based Routing**: Todas las peticiones con prefijo `/api/inventario/*` son dirigidas a este microservicio.

```text
Frontend (Vercel) -> API Gateway / ALB -> bff-web (8080)
                                            |
                                            v (vía ALB interno: /api/inventario/*)
                                     ms-inventario (Puerto 8081)
                                            |
                                     db_inventario (PostgreSQL)
```

---

## 2. Seguridad y Control de Acceso

El microservicio está configurado como **OAuth2 Resource Server** con AWS Cognito:

### Catálogo Público y Resiliencia Anónima
* Las consultas de lectura de catálogo y existencias (`GET /api/inventario/productos/**`) tienen acceso público (`permitAll()`).
* **Manejo Seguro de Autenticación**: El controlador `ProductoController` implementa validaciones seguras contra `Authentication == null` en `esAdmin(...)`, evitando caídas por `NullPointerException` (HTTP 500) cuando las peticiones provienen de usuarios anónimos o del BFF.

### Endpoints Protegidos
* **Auditoría de Movimientos**: `GET /api/inventario/productos/*/movimientos` y `GET /api/inventario/movimientos` requieren estrictamente `ROLE_ADMIN`.
* **Mutaciones de Catálogo**: `POST`, `PUT` y `PATCH` requieren `ROLE_ADMIN`.
* **Ajustes de Stock**: `POST /api/inventario/stock/entrada` (`ADMIN` o scope write) y `POST /api/inventario/stock/salida` (`CLIENTE`, `ADMIN` o scope write).

### Validación de Tokens de Acceso de Cognito
* Validador `CognitoTokenUseValidator`: Exige `token_use: "access"`.
* Validador `CognitoAudienceValidator`: Valida `client_id` o `aud` contra el App Client ID configurado.
* Conversor `CognitoAuthoritiesConverter`: Extrae de forma limpia `ROLE_ADMIN` y `ROLE_CLIENTE`, filtrando grupos técnicos federados generados por Cognito (por ejemplo `us-east-1_..._Google`).

---

## 3. Endpoints Principales

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventario/productos` | **Público** | Catálogo general (filtros opcionales `categoria`, `nombre`, `activo`) |
| `GET` | `/api/inventario/productos/{id}` | **Público** | Consulta de producto por ID |
| `GET` | `/api/inventario/productos/sku/{sku}` | **Público** | Consulta de producto por SKU |
| `GET` | `/api/inventario/productos/{id}/stock` | **Público** | Stock actual del producto |
| `POST` | `/api/inventario/productos` | `ROLE_ADMIN` | Crear producto en el catálogo |
| `PUT` | `/api/inventario/productos/{id}` | `ROLE_ADMIN` | Actualizar producto |
| `PATCH` | `/api/inventario/productos/{id}/estado` | `ROLE_ADMIN` | Activar o desactivar producto |
| `POST` | `/api/inventario/stock/validar` | Autenticado | Valida disponibilidad de stock |
| `POST` | `/api/inventario/stock/entrada` | `ROLE_ADMIN` | Entrada de stock (invocado por `ms-compras`) |
| `POST` | `/api/inventario/stock/salida` | `ROLE_CLIENTE` / `ROLE_ADMIN` | Salida de stock (invocado por `ms-ventas`) |
| `GET` | `/api/inventario/movimientos` | `ROLE_ADMIN` | Historial completo de movimientos |
| `GET` | `/api/inventario/productos/{id}/movimientos` | `ROLE_ADMIN` | Movimientos por producto específico |
| `GET` | `/actuator/health` | **Público** | Health check para ALB y ECS |

---

## 4. Despliegue CI/CD

El repositorio incluye el workflow de **GitHub Actions** [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml):
* **Disparador**: `git push origin main`.
* **Acción**: Construye la imagen multi-etapa en Docker Buildx con Java 21 y la publica en Docker Hub:
  ```text
  tag: <DOCKERHUB_USERNAME>/agrocenter-ms-inventario:latest
  ```
* **Actualización en AWS**: La tarea de Fargate en el clúster ECS se actualiza automáticamente con la nueva versión de la imagen y se asocia al Target Group `tg-ms-inventario`.

---

## 5. Pruebas y Verificación Local

```bash
# Ejecutar suite de pruebas unitarias y de integración de seguridad
./mvnw clean test
```
* **Cobertura de Pruebas**: Incluye pruebas de bloqueo pesimista contra condiciones de carrera, validación de idempotencia por referencia, y tests de seguridad con solicitudes con y sin token JWT (`SecurityIntegrationTest`).
