import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Rocket } from "lucide-react";
import { PartnerApiError, partnerApi, setPartnerKey } from "../api/partner";

// Portal público de partners: aquí registran su app de ayuda para federar
// puntos con nosotros. El registro emite la PRIMERA API key (visible una sola
// vez) y queda pendiente de aprobación por un moderador.
export function Partners() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"register" | "access">("register");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await partnerApi.register({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        contactEmail: contactEmail.trim(),
      });
      setIssuedKey(res.apiKey);
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : "No pudimos registrar tu app.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccess(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setPartnerKey(accessKey.trim());
      await partnerApi.whoami(); // valida la key antes de entrar
      navigate("/partners/dashboard");
    } catch (err) {
      setPartnerKey(null);
      setError(err instanceof PartnerApiError ? err.message : "API key inválida.");
    } finally {
      setBusy(false);
    }
  }

  // Tras registrar: muestra la key UNA vez con aviso fuerte + copiar.
  if (issuedKey) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          ¡App registrada! Guarda tu API key
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Esta clave <strong>no volverá a mostrarse</strong>. Tu partnership queda
          <strong> pendiente de aprobación</strong>: un moderador la revisará y entonces tu key
          podrá enviar puntos (mientras tanto puedes configurar tus mapeos en el dashboard).
        </p>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <code className="block break-all font-mono text-sm text-amber-900 dark:text-amber-200">
            {issuedKey}
          </code>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issuedKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard no disponible */
                }
              }}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {copied ? "¡Copiada!" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPartnerKey(issuedKey);
                navigate("/partners/dashboard");
              }}
              className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-600 dark:text-amber-200"
            >
              Ir al dashboard con esta key
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Portal de partners</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        ¿Tienes una app de ayuda? Federa tus puntos con nosotros: envíanos tus puntos por API y
        recibe los nuestros por webhook.{" "}
        <Link to="/partners/guia" className="font-medium text-brand underline">
          Mira el paso a paso
        </Link>{" "}
        · Documentación técnica en{" "}
        <a href="/api/docs" target="_blank" rel="noreferrer" className="font-medium text-brand underline">
          /api/docs (Swagger)
        </a>
        .
      </p>

      <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "register" ? "bg-white shadow dark:bg-gray-900" : "text-gray-500"}`}
        >
          <Rocket className="mr-1 inline h-4 w-4" /> Registrar mi app
        </button>
        <button
          type="button"
          onClick={() => setMode("access")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "access" ? "bg-white shadow dark:bg-gray-900" : "text-gray-500"}`}
        >
          <KeyRound className="mr-1 inline h-4 w-4" /> Ya tengo API key
        </button>
      </div>

      {mode === "register" ? (
        <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre de tu app
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="App de Ayuda del Valle"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Identificador (slug)
            <input
              required
              pattern="[a-z0-9][a-z0-9-]*"
              title="Solo minúsculas, números y guiones"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="ayuda-valle"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Correo de contacto
            <input
              required
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="equipo@miapp.com"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Registrando…" : "Registrar y obtener API key"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAccess} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tu API key
            <input
              required
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="apc_…"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Validando…" : "Entrar al dashboard"}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        La key se guarda solo en tu navegador (localStorage) y se envía como header{" "}
        <code>X-API-Key</code> en cada petición.{" "}
        <Link to="/" className="underline">
          Volver al mapa
        </Link>
      </p>
    </div>
  );
}
