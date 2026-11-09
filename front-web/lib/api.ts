import { getAuthToken, isTokenExpired } from "./cognito";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

export class HttpError extends Error {
  status: number;
  data: any;
  responseBody?: string;

  constructor(message: string, status: number, data?: any, responseBody?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
    this.responseBody = responseBody;
  }
}

/**
 * Cliente HTTP único del panel EC2.
 *
 * Toda petición al BFF inyecta el access token propagado desde el sitio
 * principal. El token se resuelve en cada llamada (no se captura una sola vez)
 * para que el handoff por URL y la persistencia en storage funcionen incluso si
 * el componente se montó antes de adoptar la sesión.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const isProtectedEndpoint =
    cleanEndpoint.includes("/bff/inventario") ||
    cleanEndpoint.includes("/bff/admin") ||
    cleanEndpoint.includes("/bff/compras");

  // 1. Resolver el access token vigente (URL -> storage -> fallback dev opcional).
  const activeToken = getAuthToken();

  // 2. Autorización previa: las rutas privadas no deben viajar anónimas.
  if (!activeToken && (isWriteMethod || isProtectedEndpoint)) {
    throw new HttpError(
      "Operación no autorizada: no hay un access token Bearer vigente. " +
        "Abre este entorno desde el botón de cambio de entorno del sitio principal " +
        "para propagar la sesión de Cognito.",
      401
    );
  }

  if (activeToken && isTokenExpired(activeToken)) {
    throw new HttpError(
      "Sesión expirada: el access token de Cognito ha caducado. Vuelve a iniciar sesión en el sitio principal.",
      401
    );
  }

  // 3. Encabezados con inyección obligatoria del token.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }

  // Idempotency-Key para POST hacia el BFF si no viene provista.
  if (method === "POST" && !headers["Idempotency-Key"] && !headers["idempotency-key"]) {
    headers["Idempotency-Key"] =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // En EC2 el frontend y el BFF comparten host (Nginx proxea /api al BFF).
  // Las URLs relativas funcionan tanto en Nginx como en SSR de Next.js.
  const targetUrl = `${API_BASE_URL}${cleanEndpoint}`;
  const response = await fetch(targetUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Error HTTP ${response.status} (${response.statusText || "Error"})`;
    let parsedData: any = null;

    try {
      parsedData = JSON.parse(errorBody);
      if (Array.isArray(parsedData?.errors) && parsedData.errors.length > 0) {
        const fieldErrors = parsedData.errors
          .map((e: any) => (e.field ? `${e.field}: ${e.defaultMessage || e.message}` : e.defaultMessage || e.message))
          .join(" | ");
        errorMessage = `Error de validación (${response.status}): ${fieldErrors}`;
      } else {
        errorMessage =
          parsedData?.message ||
          parsedData?.error ||
          parsedData?.detail ||
          errorMessage;
      }
    } catch {
      if (errorBody && errorBody.length < 300) {
        errorMessage = `Error HTTP ${response.status}: ${errorBody}`;
      }
    }

    throw new HttpError(errorMessage, response.status, parsedData, errorBody);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
