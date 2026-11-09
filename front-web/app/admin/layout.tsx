"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { adoptSessionFromUrl, readAuthSession, saveAuthToken } from "@/lib/cognito";
import { apiRequest } from "@/lib/api";
import { verifyAdminAccess } from "@/lib/admin-access";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    verifyAdminAccess(adoptSessionFromUrl() ?? readAuthSession(), () => apiRequest("/api/bff/admin/dashboard", {
      signal: controller.signal,
      cache: "no-store",
    })).then((allowed) => {
      if (active) setStatus(allowed ? "allowed" : "denied");
      window.clearTimeout(timeout);
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  function adoptManualToken(event: FormEvent) {
    event.preventDefault();
    try {
      saveAuthToken(tokenInput);
      setTokenError("");
      setStatus("checking");
      setAttempt((value) => value + 1);
    } catch (error: unknown) {
      setTokenError(
        error instanceof Error ? error.message : "No fue posible guardar el token.",
      );
    }
  }

  if (status === "allowed") return children;
  return (
    <main className="shell section" style={{ paddingBlock: 80 }}>
      <h1>{status === "checking" ? "Verificando acceso…" : "Acceso restringido"}</h1>
      <p role="status" style={{ marginBlock: 24 }}>
        {status === "checking"
          ? "Estamos comprobando tus permisos de administración."
          : "No pudimos autorizar el acceso. Abre este entorno desde el botón de cambio de entorno del sitio principal para propagar tu access token de Cognito. También puedes pegar un access token vigente para reintentar."}
      </p>
      {status !== "checking" && (
        <form onSubmit={adoptManualToken} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <label htmlFor="admin-access-token" style={{ fontWeight: 600 }}>
            Access token de Cognito
          </label>
          <input
            id="admin-access-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="eyJraWQiOi..."
            style={{ padding: 12, border: "1px solid #cbd5e1", borderRadius: 8 }}
          />
          {tokenError && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{tokenError}</p>}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="solid-cta" type="submit" disabled={!tokenInput.trim()}>
              Validar token
            </button>
            <Link href="/">Volver al inicio</Link>
          </div>
          <small>
            Debe ser un access token de Cognito (<code>token_use=access</code>), no un id_token.
          </small>
        </form>
      )}
    </main>
  );
}
