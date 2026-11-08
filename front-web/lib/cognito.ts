export type AuthSession = {
  accessToken: string;
  idToken?: string;
  name: string;
  role: string;
  email?: string;
  isAuthenticated?: boolean;
  demo?: boolean;
  groups?: string[];
};

/**
 * ============================================================================
 * MODO DEMO ESTÁTICO (V1) — AUTENTICACIÓN SIMULADA
 * ============================================================================
 * Se omite temporalmente AWS Cognito para poder desplegar el frontend como
 * sitio estático (Nginx / EC2). No hay redirect al Hosted UI ni intercambio
 * de tokens: toda sesión devuelta tiene privilegios de administrador.
 *
 * Para volver a la autenticación real, restaurar la implementación previa
 * basada en PKCE + Cognito Hosted UI.
 * ============================================================================
 */

const SESSION_KEY = "agrocenter.auth";
const VERIFIER_KEY = "agrocenter.pkce.verifier";
const STATE_KEY = "agrocenter.pkce.state";
const CONSUMED_CODE_KEY = "agrocenter.pkce.consumed_code";

// JWT de desarrollo firmado con DEV_JWT_SECRET (compose local). Caduca en 2036.
// Permite que el panel admin funcione contra los microservicios en perfil `dev`.
// Si cambias DEV_JWT_SECRET, regenera este token.
const DEV_ADMIN_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwODEvZGV2LWlzc3VlciIsInN1YiI6ImFkbWluQGFncm9jZW50ZXIubG9jYWwiLCJhdWQiOlsiYWdyb2NlbnRlci1hcGkiXSwiaWF0IjoxNzk0MTUwMTkyLCJuYmYiOjE3OTQxNTAxOTIsImV4cCI6MjEwOTUxMDE5MiwianRpIjoiN2Y2NmZiODktNWJmMy00OGNjLWIwNmEtMjI3YzdmNmNiODNjIiwidG9rZW5fdXNlIjoiYWNjZXNzIiwiY29nbml0bzpncm91cHMiOlsiQURNSU4iXSwic2NvcGUiOiJpbnZlbnRhcmlvLnN0b2NrLnJlYWQgaW52ZW50YXJpby5zdG9jay53cml0ZSJ9.uJLAC3FtcAtxnb53-P917wsOWyP_dozH5a9KwP0HPtg";

const MOCK_ADMIN_SESSION: AuthSession = {
  isAuthenticated: true,
  accessToken: DEV_ADMIN_ACCESS_TOKEN,
  idToken: "mock-id-token-admin-v1",
  name: "Administrador AgroCenter",
  role: "ROLE_ADMIN",
  email: "admin@agrocenter.local",
  demo: true,
  groups: ["ROLE_ADMIN"],
};

/**
 * Devuelve la sesión simulada de administrador por defecto.
 * Es segura de invocar en SSR porque no depende de `window`.
 */
export function getStoredSession(): AuthSession {
  return {
    ...MOCK_ADMIN_SESSION,
    groups: [...(MOCK_ADMIN_SESSION.groups ?? [])],
  };
}

/**
 * Extrae un token Bearer/JWT desde una instancia de Storage (sessionStorage o localStorage)
 * soportando tanto JSON serializado como cadenas de texto planas.
 */
function extractTokenFromStorage(storage: Storage): string | null {
  const candidateKeys = [
    SESSION_KEY,
    "accessToken",
    "access_token",
    "token",
    "jwt",
    "auth_token",
    "idToken",
    "id_token",
  ];

  for (const key of candidateKeys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // 1. Si está serializado en JSON (e.g. objeto AuthSession o { token: "..." })
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(trimmed);
        const candidate =
          parsed.accessToken ||
          parsed.access_token ||
          parsed.token ||
          parsed.jwt ||
          parsed.idToken ||
          parsed.id_token;
        if (typeof candidate === "string" && candidate.trim().length > 10) {
          return candidate.trim().replace(/^Bearer\s+/i, "");
        }
      }

      // 2. Si está almacenado como string plano (e.g. JWT "eyJ...")
      if (trimmed.length > 10 && !trimmed.startsWith("{")) {
        return trimmed.replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
      }
    } catch {
      // Ignorar entradas inválidas y continuar probando siguientes claves
    }
  }
  return null;
}

/**
 * Guarda y adopta un token JWT en sessionStorage y localStorage.
 */
export function saveAuthToken(rawToken: string): AuthSession {
  const cleanToken = rawToken.trim().replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  const claims = decodeClaims(cleanToken);
  const adoptedSession: AuthSession = {
    isAuthenticated: true,
    accessToken: cleanToken,
    idToken: cleanToken,
    name: (claims["cognito:username"] || claims["name"] || claims["email"] || claims["sub"] || "Administrador AgroCenter") as string,
    role: "ROLE_ADMIN",
    email: (claims["email"] || claims["sub"] || "admin@agrocenter.local") as string,
    demo: false,
    groups: (Array.isArray(claims["cognito:groups"]) && claims["cognito:groups"].length > 0
      ? (claims["cognito:groups"] as string[])
      : ["ROLE_ADMIN"]),
  };

  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(adoptedSession);
      sessionStorage.setItem(SESSION_KEY, serialized);
      localStorage.setItem(SESSION_KEY, serialized);
      sessionStorage.setItem("accessToken", cleanToken);
      localStorage.setItem("accessToken", cleanToken);
    } catch {
      // Storage no disponible o cuota excedida
    }
  }

  return adoptedSession;
}

/** En modo demo o handoff de sesión: adopta token por query string, hash fragment, storage o mock fallback. */
export function readAuthSession(): AuthSession | null {
  if (typeof window !== "undefined") {
    try {
      // 1. Buscar en Query String (?token=... o ?access_token=... o ?accessToken=...)
      const urlParams = new URLSearchParams(window.location.search);
      let incomingToken =
        urlParams.get("token") ||
        urlParams.get("accessToken") ||
        urlParams.get("access_token") ||
        urlParams.get("jwt") ||
        urlParams.get("idToken") ||
        urlParams.get("id_token");

      // 2. Si no está en query string, buscar en Hash fragment (#access_token=... o #token=...)
      if (!incomingToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        incomingToken =
          hashParams.get("token") ||
          hashParams.get("access_token") ||
          hashParams.get("accessToken") ||
          hashParams.get("jwt") ||
          hashParams.get("id_token") ||
          hashParams.get("idToken");
      }

      if (incomingToken) {
        const adopted = saveAuthToken(incomingToken);

        // Limpiar parámetros de la URL sin recargar la página
        urlParams.delete("token");
        urlParams.delete("accessToken");
        urlParams.delete("access_token");
        urlParams.delete("jwt");
        urlParams.delete("idToken");
        urlParams.delete("id_token");
        const cleanSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "");
        window.history.replaceState({}, "", cleanUrl);
        return adopted;
      }

      // 3. Si no viene en URL, verificar exhaustivamente en sessionStorage y localStorage
      const tokenFromSession = extractTokenFromStorage(sessionStorage);
      if (tokenFromSession) {
        return saveAuthToken(tokenFromSession);
      }

      const tokenFromLocal = extractTokenFromStorage(localStorage);
      if (tokenFromLocal) {
        return saveAuthToken(tokenFromLocal);
      }
    } catch {
      // Ignorar errores de parsing y usar mock fallback
    }
  }
  return getStoredSession();
}

/** Cognito está "configurado" en modo demo para que la UI use el flujo simulado. */
export function cognitoIsConfigured(): boolean {
  return true;
}

/** Reemplaza el intercambio real de tokens por la sesión simulada. */
export async function beginCognitoSignIn(): Promise<AuthSession> {
  // Sin redirect al Hosted UI de Cognito.
  return getStoredSession();
}

/** No hay callback OAuth real; se limpia cualquier `?code` residual y se entra directo. */
export async function completeCognitoSignIn(): Promise<AuthSession | null> {
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(window.location.search);
    if (query.has("code") || query.has("state")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }
  return getStoredSession();
}

/** Mantiene la compatibilidad con el flujo anterior de "modo demo". */
export function createDemoSession(): AuthSession {
  return getStoredSession();
}

export function isUserAdmin(session: AuthSession | null): boolean {
  if (!session) return false;
  if (session.demo) return true;
  if (session.role?.toUpperCase() === "ADMIN" || session.role?.toUpperCase() === "ROLE_ADMIN") {
    return true;
  }
  if (session.groups?.some((g) => g.toUpperCase() === "ADMIN" || g.toUpperCase() === "ROLE_ADMIN")) {
    return true;
  }
  const checkToken = (token?: string) => {
    if (!token) return false;
    const claims = decodeClaims(token);
    const groups = Array.isArray(claims["cognito:groups"]) ? claims["cognito:groups"] : [];
    return groups.some((g: unknown) => {
      const val = String(g).toUpperCase();
      return val === "ADMIN" || val === "ROLE_ADMIN";
    });
  };
  return checkToken(session.idToken) || checkToken(session.accessToken);
}

export function signOut() {
  if (typeof window === "undefined") return;

  // Limpia cualquier token real que haya quedado de una sesión anterior.
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(CONSUMED_CODE_KEY);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(CONSUMED_CODE_KEY);
  }

  // Sin redirect a `${domain}/logout`: el sitio estático no depende de Cognito.
}

function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return {};
  }
}
