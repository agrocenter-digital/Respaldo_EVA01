import { readAuthSession } from "./cognito";

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

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const session = readAuthSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Se prioriza el accessToken requerido por los Resource Servers (CognitoTokenUseValidator exige token_use: "access")
  const rawToken = session?.accessToken || session?.idToken;
  const cleanToken = rawToken ? rawToken.replace(/^Bearer\s+/i, "").trim() : "";
  if (cleanToken && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${cleanToken}`;
  }

  // Garantizar idempotency-key para solicitudes POST hacia el BFF si no viene provista
  const method = (options.method || "GET").toUpperCase();
  if (method === "POST" && !headers["Idempotency-Key"] && !headers["idempotency-key"]) {
    headers["Idempotency-Key"] =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
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

  // Si la respuesta es 204 No Content o no tiene body
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
