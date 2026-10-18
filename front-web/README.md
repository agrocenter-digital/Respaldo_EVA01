# AgroCenter Digital — Frontend Web (`front-web`)

Aplicación web React / Next.js para la plataforma **AgroCenter Digital**, optimizada para la experiencia de clientes y administradores en la gestión de compras, ventas, inventario y catálogo.

---

## 1. Entorno de Producción y Alojamiento

* **URL de Producción (Vercel)**: [`https://front-web-seven.vercel.app`](https://front-web-seven.vercel.app/)
* **Integración CI/CD**:
  - **Vercel Git Integration**: Cada `git push` a la rama `main` dispara automáticamente la optimización y el despliegue a la red global de Vercel.
  - **GitHub Actions (`.github/workflows/deploy.yml`)**: Construye en paralelo la imagen Docker multi-etapa y la sube al repositorio Docker Hub como `agrocenter-frontend:latest`.

---

## 2. Autenticación y Flujo de Sesión

La aplicación utiliza **AWS Cognito** con autenticación segura:
* **Protocolo**: OAuth 2.0 Authorization Code con **PKCE** (Proof Key for Code Exchange).
* **Proveedores de Identidad**: Soporta autenticación nativa de Cognito y federación con **Google**.
* **Manejo de Tokens en Cliente (`lib/api.ts`)**:
  - El cliente HTTP prioriza estrictamente el **`accessToken`** sobre el `idToken` para comunicarse con las APIs del backend.
  - Los endpoints protegidos viajan con la cabecera estándar:
    ```http
    Authorization: Bearer <accessToken>
    ```
  - Los roles y permisos (`ROLE_CLIENTE`, `ROLE_ADMIN`) son interpretados automáticamente por el backend a partir de los claims (`cognito:groups`).
* **Modo Demostración**: Si no se configuran variables de Cognito, la interfaz ofrece un modo de prueba local en memoria para evaluar componentes visuales sin dependencias de red.

---

## 3. Variables de Entorno

Crear un archivo `.env.local` basado en `.env.example`:

| Variable | Descripción | Ejemplo / Producción |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | URL del BFF o API Gateway | `https://...amazonaws.com` o `http://localhost:8080` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Dominio Hosted UI de AWS Cognito | `https://tu-dominio.auth.us-east-1.amazoncognito.com` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | App Client ID de Cognito (público) | `tu_app_client_id` |
| `NEXT_PUBLIC_COGNITO_REDIRECT_URI`| Callback de redirección tras login | `https://front-web-seven.vercel.app` o `http://localhost:3000` |

---

## 4. Ejecución Local

### Requisitos
* Node.js `>=20.x` o `>=22.x`
* npm `>=10.x`

### Comandos de Desarrollo
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```
La aplicación iniciará en `http://localhost:3000`.

### Verificación y Calidad
```bash
# Validar compilación de producción
npm run build

# Ejecutar suite de pruebas
npm test
```

---

## 5. Docker

El proyecto cuenta con un `Dockerfile` multi-stage optimizado sobre Alpine Linux con usuario no-root (`agrocenter`):

```bash
# Construir imagen local
docker build -t agrocenter-front-web:latest .

# Ejecutar contenedor
docker run -d --name agrocenter-front -p 3000:3000 agrocenter-front-web:latest
```
