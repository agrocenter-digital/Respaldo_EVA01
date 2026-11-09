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
 * SESIÓN PROPAGADA DESDE EL SITIO PRINCIPAL (Vercel / Producción)
 * ============================================================================
 * El panel EC2 no inicia sesión por sí mismo: recibe un access token de
 * Cognito desde la redirección del sitio principal. Ese token se adopta desde
 * el fragmento `#token=...` (preferido) o desde el query string, se persiste
 * en sessionStorage/localStorage y se inyecta en cada llamada al BFF.
 *
 * Reglas de seguridad:
 *   1. El backend SOLO acepta access tokens de Cognito (`token_use=access`).
 *      Un id_token nunca se envía como Authorization Bearer.
 *   2. No existe un JWT de desarrollo embebido en el bundle de producción.
 *   3. Si no hay token válido la sesión es nula; el panel no inventa un ADMIN.
 *   4. Los parámetros con credenciales se eliminan de la URL tras adoptarlos.
 * ============================================================================
 */

const SESSION_KEY = "agrocenter.auth";
const VERIFIER_KEY = "agrocenter.pkce.verifier";
const STATE_KEY = "agrocenter.pkce.state";
const CONSUMED_CODE_KEY = "agrocenter.pkce.consumed_code";

// Fallback opcional SOLO para desarrollo local. Nunca debe configurarse en
// producción: el valor se inlinea en el bundle del navegador.
const DEV_FALLBACK_TOKEN = (
  process.env.NEXT_PUBLIC_DEV_JWT_FALLBACK_TOKEN ?? ""
).trim();

const ACCESS_TOKEN_PARAMS = ["token", "accessToken", "access_token", "jwt"];
const ID_TOKEN_PARAMS = ["idToken", "id_token"];
const IDENTITY_PARAMS = ["name", "email", "role"];
const HANDOFF_PARAMS = [...ACCESS_TOKEN_PARAMS, ...ID_TOKEN_PARAMS, ...IDENTITY_PARAMS];

function devFallbackEnabled() {
  return process.env.NODE_ENV === "development" && DEV_FALLBACK_TOKEN.length > 20;
}

function cleanToken(value?: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeClaims(token?: string | null): Record<string, unknown> {
  if (!token) return {};
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isTokenExpired(token?: string | null): boolean {
  if (!token) return true;
  const claims = decodeClaims(token);
  if (typeof claims.exp === "number") {
    return Math.floor(Date.now() / 1000) >= claims.exp;
  }
  // Tokens opacos (sin claim exp) se aceptan; el backend hará la validación final.
  return false;
}

/**
 * Un access token de Cognito tiene `token_use=access`. Los id_token tienen
 * `token_use=id` y son rechazados por el Resource Server del BFF.
 */
export function isAccessToken(token?: string | null): boolean {
  if (!token) return false;
  const claims = decodeClaims(token);
  if (Object.keys(claims).length === 0) return true; // token opaco / no JWT
  const tokenUse = claims.token_use;
  return typeof tokenUse !== "string" || tokenUse.toLowerCase() === "access";
}

function groupsOf(claims: Record<string, unknown>): string[] {
  const raw = claims["cognito:groups"];
  if (Array.isArray(raw)) {
    return raw.filter((group): group is string => typeof group === "string");
  }
  if (typeof raw === "string") {
    return raw
      .replace(/^\[|\]$/g, "")
      .split(/[,\s]+/)
      .map((value) => value.replace(/["']/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

function isAdminClaims(claims: Record<string, unknown>): boolean {
  const groups = groupsOf(claims);
  const role = String(claims.role ?? claims["custom:role"] ?? "").toUpperCase();
  const scopes = String(claims.scope ?? "")
    .split(/\s+/)
    .map((scope) => scope.toLowerCase());

  return (
    groups.some((group) => {
      const value = group.toUpperCase();
      return value === "ADMIN" || value === "ROLE_ADMIN";
    }) ||
    role.includes("ADMIN") ||
    scopes.some(
      (scope) =>
        scope === "inventario.stock.write" ||
        scope === "inventario.stock.read",
    )
  );
}

function roleFromClaims(claims: Record<string, unknown>): string {
  if (isAdminClaims(claims)) return "ADMIN";
  const groups = groupsOf(claims);
  if (groups.length > 0) return groups[0];
  const role = claims.role ?? claims["custom:role"];
  return typeof role === "string" && role.trim() ? role.trim() : "Usuario operativo";
}

function buildSession(
  accessToken: string,
  idToken?: string,
  overrides: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    groups?: string[];
  } = {},
): AuthSession {
  const claims = decodeClaims(idToken || accessToken);
  const groups = overrides.groups?.length ? overrides.groups : groupsOf(claims);
  const role = overrides.role?.trim() || roleFromClaims(claims);
  const name =
    overrides.name?.trim() ||
    String(
      claims.name ??
        claims["cognito:username"] ??
        claims.email ??
        claims.sub ??
        "Usuario AgroCenter",
    );
  const email =
    overrides.email?.trim() ||
    (typeof claims.email === "string" ? claims.email : undefined);

  return {
    isAuthenticated: true,
    accessToken,
    idToken: idToken || undefined,
    name,
    role,
    email,
    demo: false,
    groups,
  };
}

function clearAuthStorage() {
  if (typeof window === "undefined") return;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      storage.removeItem(SESSION_KEY);
      storage.removeItem("accessToken");
      storage.removeItem("access_token");
      storage.removeItem("token");
      storage.removeItem("idToken");
      storage.removeItem("id_token");
      storage.removeItem("jwt");
      storage.removeItem(VERIFIER_KEY);
      storage.removeItem(STATE_KEY);
      storage.removeItem(CONSUMED_CODE_KEY);
    } catch {
      // storage puede estar deshabilitado
    }
  }
}

function persistAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(session);
  try {
    window.sessionStorage.setItem(SESSION_KEY, serialized);
    window.sessionStorage.setItem("accessToken", session.accessToken);
    if (session.idToken) window.sessionStorage.setItem("idToken", session.idToken);
  } catch {
    // sessionStorage puede estar deshabilitado
  }
  try {
    window.localStorage.setItem(SESSION_KEY, serialized);
    window.localStorage.setItem("accessToken", session.accessToken);
    if (session.idToken) window.localStorage.setItem("idToken", session.idToken);
  } catch {
    // localStorage puede estar deshabilitado
  }
}

function parseStoredSession(raw?: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken.trim()) {
      return null;
    }
    const accessToken = cleanToken(parsed.accessToken);
    const idToken = cleanToken(parsed.idToken);
    return buildSession(accessToken, idToken, {
      name: parsed.name,
      email: parsed.email,
    });
  } catch {
    return null;
  }
}

function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const value = window[storageName].getItem(key);
      if (value) return value;
    } catch {
      // storage puede estar deshabilitado
    }
  }
  return null;
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const raw = storageGet(SESSION_KEY);
  const session = parseStoredSession(raw);

  if (session) {
    if (
      !session.accessToken ||
      isTokenExpired(session.accessToken) ||
      !isAccessToken(session.accessToken)
    ) {
      clearAuthStorage();
      return null;
    }
    return session;
  }

  // Compatibilidad con versiones anteriores que guardaban el token plano.
  const legacy =
    storageGet("accessToken") ||
    storageGet("token") ||
    storageGet("jwt");

  const legacyToken = cleanToken(legacy);
  if (
    legacyToken &&
    !isTokenExpired(legacyToken) &&
    isAccessToken(legacyToken)
  ) {
    return buildSession(legacyToken);
  }

  return null;
}

/**
 * Adopta la sesión enviada desde el sitio principal.
 *
 * Acepta credenciales tanto en el fragmento (`#token=...&idToken=...`) como en
 * el query string (`?token=...`), desde `window.location`. El fragmento es el
 * mecanismo recomendado porque no llega a logs de Nginx ni a cabeceras Referer.
 * Después de persistir la sesión, elimina las credenciales de la URL.
 */
export function adoptSessionFromUrl(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const query = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

  const pick = (keys: string[]): string | null => {
    for (const key of keys) {
      const value = query.get(key) ?? hash.get(key);
      if (value && value.trim()) return value.trim();
    }
    return null;
  };

  const rawAccessToken = cleanToken(pick(ACCESS_TOKEN_PARAMS));
  const rawIdToken = cleanToken(pick(ID_TOKEN_PARAMS));
  const incomingName = pick(["name"]);
  const incomingEmail = pick(["email"]);

  const hasCredentials = Boolean(rawAccessToken || rawIdToken);
  if (!hasCredentials) return null;

  // Limpiar credenciales de la URL ANTES de validar, incluso si el token es inválido.
  HANDOFF_PARAMS.forEach((key) => query.delete(key));
  url.search = query.toString();

  if (HANDOFF_PARAMS.some((key) => hash.has(key))) {
    HANDOFF_PARAMS.forEach((key) => hash.delete(key));
    const remainingHash = hash.toString();
    url.hash = remainingHash ? `#${remainingHash}` : "";
  }

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );

  // Preferimos el access token. Si solo llegó un id_token no sirve para el BFF.
  let accessToken = rawAccessToken;
  if (accessToken && !isAccessToken(accessToken)) {
    console.warn(
      "[auth] El parámetro 'token' contiene un id_token; se requiere un access token de Cognito.",
    );
    accessToken = "";
  }
  if (!accessToken && rawIdToken && isAccessToken(rawIdToken)) {
    accessToken = rawIdToken;
  }

  if (!accessToken || isTokenExpired(accessToken)) {
    return null;
  }

  const usableIdToken =
    rawIdToken && !isTokenExpired(rawIdToken) ? rawIdToken : undefined;

  const session = buildSession(accessToken, usableIdToken, {
    name: incomingName,
    email: incomingEmail,
  });

  persistAuthSession(session);
  return session;
}

/**
 * Devuelve la sesión activa: primero adopta credenciales de la URL y luego
 * consulta el almacenamiento del navegador. En SSR devuelve null.
 */
export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const fromUrl = adoptSessionFromUrl();
  if (fromUrl) return fromUrl;
  const stored = readStoredSession();
  if (stored) return stored;
  if (devFallbackEnabled()) {
    return buildSession(DEV_FALLBACK_TOKEN);
  }
  return null;
}

/**
 * Token que debe viajar en `Authorization: Bearer <token>`.
 * Devuelve null si no hay access token válido; nunca devuelve un id_token.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const session = readAuthSession();
  const token = cleanToken(session?.accessToken);
  if (!token || isTokenExpired(token) || !isAccessToken(token)) return null;
  return token;
}

/**
 * Guarda un access token recibido manualmente o desde un handoff.
 * `options.idToken` conserva el id_token real (grupos/identidad) sin
 * sobrescribirlo con el access token.
 */
export function saveAuthToken(
  rawToken: string,
  options: {
    idToken?: string;
    name?: string;
    email?: string;
    role?: string;
  } = {},
): AuthSession {
  const accessToken = cleanToken(rawToken);
  if (!accessToken) {
    throw new Error("El token JWT no puede estar vacío.");
  }
  if (!isAccessToken(accessToken)) {
    throw new Error(
      "El valor entregado es un id_token. El BFF requiere un access token de Cognito.",
    );
  }

  const idToken = cleanToken(options.idToken);
  const session = buildSession(
    accessToken,
    idToken && !isTokenExpired(idToken) ? idToken : undefined,
    options,
  );
  persistAuthSession(session);
  return session;
}

export function getStoredSession(): AuthSession | null {
  return readStoredSession();
}

/** En el panel EC2 no hay login local: la sesión se origina en el sitio principal. */
export function cognitoIsConfigured(): boolean {
  return true;
}

/**
 * No se redirige al Hosted UI desde el panel. Si ya existe sesión se devuelve;
 * de lo contrario se informa que debe iniciarse sesión desde el sitio principal.
 */
export async function beginCognitoSignIn(): Promise<AuthSession> {
  const active = readAuthSession();
  if (active) return active;
  throw new Error(
    "Este panel recibe la sesión desde el sitio principal. Inicia sesión allí y vuelve a abrir el entorno V1.",
  );
}

/** No hay callback OAuth local. Limpia un `?code` residual y devuelve la sesión adoptada. */
export async function completeCognitoSignIn(): Promise<AuthSession | null> {
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(window.location.search);
    if (query.has("code") || query.has("state")) {
      query.delete("code");
      query.delete("state");
      const remaining = query.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${remaining ? `?${remaining}` : ""}${window.location.hash}`,
      );
    }
  }
  return readAuthSession();
}

export function createDemoSession(): AuthSession {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("El modo demo no está disponible en producción.");
  }
  const session = buildSession("demo-access-token", undefined, {
    name: "Camila Muñoz",
    email: "camila@agrocenter.cl",
    role: "ADMIN",
    groups: ["ADMIN"],
  });
  session.demo = true;
  persistAuthSession(session);
  return session;
}

export function isUserAdmin(session: AuthSession | null): boolean {
  if (!session?.accessToken || session.demo) return false;
  if (
    session.role?.toUpperCase() === "ADMIN" ||
    session.role?.toUpperCase() === "ROLE_ADMIN"
  ) {
    return true;
  }
  if (
    session.groups?.some((group) => {
      const value = group.toUpperCase();
      return value === "ADMIN" || value === "ROLE_ADMIN";
    })
  ) {
    return true;
  }
  return (
    isAdminClaims(decodeClaims(session.idToken)) ||
    isAdminClaims(decodeClaims(session.accessToken))
  );
}

export function signOut() {
  if (typeof window === "undefined") return;
  clearAuthStorage();
}
