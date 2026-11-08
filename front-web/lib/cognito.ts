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

/** En modo demo siempre existe una sesión de administrador. */
export function readAuthSession(): AuthSession | null {
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
