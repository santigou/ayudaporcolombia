import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  KeyRound,
  LogOut,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Webhook,
  XCircle,
} from "lucide-react";
import {
  DeliveryView,
  PartnerApiKeyView,
  PartnerMappingView,
  PartnerView,
  PartnerApiError,
  getPartnerKey,
  partnerApi,
  setPartnerKey,
} from "../api/partner";
import { JsonTextarea, JsonView } from "../components/JsonTextarea";

// ============================================================================
// Dashboard del partner (entra con su API key, guardada en localStorage).
// Diseño: tarjeta-cabecera (identidad + estado + tabs) y contenido en tarjetas
// uniformes (cardCls) con títulos de sección tipo "label" (SectionTitle).
// ============================================================================

const cardCls =
  "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950";

const TONES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// Punto de estado: círculo CSS del color del texto (no usa caracteres).
function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />;
}

function SectionTitle({ icon: Icon, children, right }: { icon: any; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
      </h2>
      {right}
    </div>
  );
}

const TABS = [
  { id: "estado", label: "Estado", icon: ShieldCheck },
  { id: "keys", label: "API keys", icon: KeyRound },
  { id: "mapeos", label: "Mapeos", icon: Settings2 },
  { id: "entregas", label: "Entregas", icon: Activity },
] as const;

export function PartnerDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState<PartnerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("estado");

  const logout = () => {
    setPartnerKey(null);
    navigate("/partners");
  };

  const reload = useCallback(async () => {
    if (!getPartnerKey()) {
      navigate("/partners");
      return;
    }
    try {
      setMe(await partnerApi.whoami());
    } catch (err) {
      if (err instanceof PartnerApiError && (err.status === 401 || err.status === 403)) {
        setPartnerKey(null);
        navigate("/partners");
        return;
      }
      setError(err instanceof Error ? err.message : "Error cargando el partnership");
    }
  }, [navigate]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className={`${cardCls} p-5`}>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => {
              setError(null);
              reload();
            }}
            className="mt-3 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!me) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-500">Cargando partnership…</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50/60 dark:bg-gray-950/40">
      <div className={`mx-auto ${tab === "mapeos" ? "max-w-6xl" : "max-w-3xl"} px-4 py-6 sm:px-6`}>
        {/* ── Tarjeta cabecera: identidad, estado y navegación ── */}
        <div className={cardCls}>
          <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
              {me.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{me.name}</h1>
              <p className="truncate font-mono text-xs text-gray-400">
                @{me.slug}
                {me.contactEmail ? ` · ${me.contactEmail}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {me.approvedAt ? (
                <Badge tone="green"><Dot /> Aprobado</Badge>
              ) : (
                <Badge tone="amber"><Dot /> Pendiente</Badge>
              )}
              {me.trusted && <Badge tone="sky">trusted</Badge>}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            </div>
          </div>

          {!me.approvedAt && (
            <p className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
              Tu API key aún <strong>no puede enviar puntos</strong>: un moderador revisará tu registro. Mientras
              tanto puedes gestionar tus keys y preparar tus mapeos en el playground.
            </p>
          )}

          {/* Tabs */}
          <nav className="flex gap-1 overflow-x-auto border-t border-gray-100 px-2 dark:border-gray-800">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                  tab === id
                    ? "border-brand text-brand-dark dark:text-brand"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Contenido del tab ── */}
        <div className="mt-5">
          {tab === "estado" && <EstadoTab me={me} onChanged={reload} />}
          {tab === "keys" && <KeysTab onChanged={reload} />}
          {tab === "mapeos" && <MapeosTab />}
          {tab === "entregas" && <EntregasTab />}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          <Link to="/" className="underline">Volver al mapa</Link> ·{" "}
          <Link to="/partners/guia" className="underline">Guía de integración</Link> ·{" "}
          <a href="/api/docs" target="_blank" rel="noreferrer" className="underline">Swagger</a>
        </p>
      </div>
    </div>
  );
}

// --- Tab Estado: dos tarjetas — partnership + webhook (self-service) ---
function EstadoTab({ me, onChanged }: { me: PartnerView; onChanged: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className={`${cardCls} p-4 lg:col-span-2`}>
        <SectionTitle icon={ShieldCheck}>Partnership</SectionTitle>
        <dl className="mt-2 divide-y divide-gray-100 text-sm dark:divide-gray-800">
          <Row k="Contacto" v={me.contactEmail ?? "—"} />
          <Row k="Registrado" v={new Date(me.createdAt).toLocaleDateString()} />
          <Row k="Aprobado" v={me.approvedAt ? new Date(me.approvedAt).toLocaleDateString() : "pendiente"} />
          <Row
            k="Enviar puntos"
            v={me.inboundEnabled ? "habilitado" : "deshabilitado"}
            tone={me.inboundEnabled ? "green" : "gray"}
          />
          <Row
            k="Publicación"
            v={me.trusted ? "inmediata (trusted)" : "con moderación"}
            tone={me.trusted ? "sky" : "gray"}
          />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          {me.trusted
            ? "Tus puntos se publican al instante. Un moderador puede retirar este privilegio."
            : "Cada punto que envíes pasa por la cola de moderación humana."}
        </p>
      </div>
      <div className="lg:col-span-3">
        <WebhookForm me={me} onChanged={onChanged} />
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: keyof typeof TONES }) {
  return (
    <div className="flex items-center justify-between gap-4 px-0.5 py-2">
      <dt className="shrink-0 text-gray-500">{k}</dt>
      <dd className="truncate text-right font-medium text-gray-800 dark:text-gray-200">
        {tone ? <Badge tone={tone}>{v}</Badge> : v}
      </dd>
    </div>
  );
}

// Edición self-service de TODO el bloque outbound salvo el interruptor
// outboundEnabled (activarlo sigue siendo decisión del moderador).
function WebhookForm({ me, onChanged }: { me: PartnerView; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [outboundUrl, setOutboundUrl] = useState(me.outboundUrl ?? "");
  const [authType, setAuthType] = useState<"api_key" | "login">(me.authType);
  const [outboundHeaderName, setOutboundHeaderName] = useState(me.outboundHeaderName ?? "");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [loginUrl, setLoginUrl] = useState(me.loginUrl ?? "");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [tokenJsonPath, setTokenJsonPath] = useState(me.tokenJsonPath ?? "");
  const [tokenHeader, setTokenHeader] = useState(me.tokenHeader ?? "");
  const [sendOnCreated, setSendOnCreated] = useState(me.sendOnCreated);
  const [sendOnUpdated, setSendOnUpdated] = useState(me.sendOnUpdated);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await partnerApi.updateMe({
        outboundUrl: outboundUrl.trim() || null,
        authType,
        outboundHeaderName: outboundHeaderName.trim() || null,
        // Secretos: solo se envían si el partner escribió uno nuevo.
        ...(apiKeyValue.trim() ? { outboundApiKeyValue: apiKeyValue.trim() } : {}),
        ...(authType === "login"
          ? {
              loginUrl: loginUrl.trim() || null,
              ...(loginEmail.trim() ? { loginEmail: loginEmail.trim() } : {}),
              ...(loginPassword.trim() ? { loginPassword: loginPassword.trim() } : {}),
              tokenJsonPath: tokenJsonPath.trim() || null,
              tokenHeader: tokenHeader.trim() || null,
            }
          : {}),
        sendOnCreated,
        sendOnUpdated,
      });
      setApiKeyValue("");
      setLoginEmail("");
      setLoginPassword("");
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando la configuración");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <SectionTitle icon={Webhook}>Webhook · recibir nuestros puntos</SectionTitle>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
      </div>

      {!me.outboundEnabled && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
          Un moderador debe activar el envío hacia tu app — deja la configuración lista mientras tanto.
        </p>
      )}

      {!editing ? (
        <dl className="divide-y divide-gray-100 px-4 text-sm dark:divide-gray-800">
          <Row
            k="URL"
            v={me.outboundUrl ?? "sin configurar"}
            tone={me.outboundUrl ? undefined : "gray"}
          />
          <Row
            k="Autenticación"
            v={
              me.authType === "api_key"
                ? `${me.outboundHeaderName ?? "X-API-Key"}: ${me.outboundApiKey ?? "sin valor"}`
                : `login · ${me.loginUrl ?? "sin URL"} · token en "${me.tokenJsonPath ?? "token"}"`
            }
          />
          <Row k="Al crear punto" v={me.sendOnCreated ? "enviar" : "no enviar"} tone={me.sendOnCreated ? "green" : "gray"} />
          <Row k="Al actualizar" v={me.sendOnUpdated ? "enviar" : "no enviar"} tone={me.sendOnUpdated ? "green" : "gray"} />
        </dl>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          <label className="text-xs font-semibold text-gray-500">
            URL del webhook (tu endpoint)
            <input
              value={outboundUrl}
              onChange={(e) => setOutboundUrl(e.target.value)}
              placeholder="https://mi-app.com/webhooks/ayuda"
              className={`${inputCls} font-mono`}
            />
          </label>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs dark:bg-gray-800">
            {(["api_key", "login"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAuthType(t)}
                className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${authType === t ? "bg-white shadow dark:bg-gray-950" : "text-gray-500"}`}
              >
                {t === "api_key" ? "API key (header estático)" : "Login con token Bearer"}
              </button>
            ))}
          </div>
          {authType === "api_key" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-500">
                Header (default X-API-Key)
                <input value={outboundHeaderName} onChange={(e) => setOutboundHeaderName(e.target.value)} placeholder="X-API-Key" className={inputCls} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Valor de la API key {me.outboundApiKey ? `(actual ${me.outboundApiKey})` : ""}
                <input
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder={me.outboundApiKey ? "vacío = conservar actual" : "la key que nos diste"}
                  className={`${inputCls} font-mono`}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-500">
                URL de login
                <input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://mi-app.com/api/login" className={`${inputCls} font-mono`} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Email {me.loginEmail ? `(actual ${me.loginEmail})` : ""}
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={me.loginEmail ? "vacío = conservar actual" : "usuario"} className={inputCls} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Password {me.hasLoginPassword ? "(vacío = conservar)" : ""}
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Path del token (default token)
                <input value={tokenJsonPath} onChange={(e) => setTokenJsonPath(e.target.value)} placeholder="data.token" className={`${inputCls} font-mono`} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Header del token (default Authorization)
                <input value={tokenHeader} onChange={(e) => setTokenHeader(e.target.value)} placeholder="Authorization" className={inputCls} />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSendOnCreated((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${sendOnCreated ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40" : "border-gray-300 text-gray-500 dark:border-gray-600"}`}
            >
              {sendOnCreated && <Check className="h-3 w-3" />} al crear punto
            </button>
            <button
              type="button"
              onClick={() => setSendOnUpdated((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${sendOnUpdated ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40" : "border-gray-300 text-gray-500 dark:border-gray-600"}`}
            >
              {sendOnUpdated && <Check className="h-3 w-3" />} al actualizar
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Guardando…" : "Guardar configuración"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tab API keys: emitir (mostrada UNA vez) / listar / revocar ---
function KeysTab({ onChanged }: { onChanged: () => void }) {
  const [keys, setKeys] = useState<PartnerApiKeyView[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKeys(await partnerApi.listKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando keys");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <SectionTitle icon={KeyRound}>Tus API keys</SectionTitle>
        <button
          onClick={async () => {
            setError(null);
            try {
              const res = await partnerApi.createKey();
              setNewKey(res.key);
              load();
              onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error emitiendo key");
            }
          }}
          className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva key
        </button>
      </div>

      {newKey && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/50">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Guárdala AHORA — no volverá a mostrarse:
          </p>
          <code className="mt-1 block break-all rounded bg-amber-100/60 p-2 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            {newKey}
          </code>
        </div>
      )}

      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-gray-800 dark:text-gray-200">
                {k.prefix}…
                {k.revokedAt && <span className="ml-2 text-[10px] font-semibold uppercase text-red-500">revocada</span>}
              </p>
              <p className="truncate text-xs text-gray-400">
                {k.lastUsedAt ? `usada ${new Date(k.lastUsedAt).toLocaleString()}` : "sin uso aún"}
              </p>
            </div>
            {!k.revokedAt && (
              <button
                onClick={async () => {
                  try {
                    await partnerApi.revokeKey(k.id);
                    load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Error revocando");
                  }
                }}
                className="flex shrink-0 items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3 w-3" /> Revocar
              </button>
            )}
          </li>
        ))}
        {keys.length === 0 && <li className="px-4 py-4 text-sm text-gray-400">Sin keys.</li>}
      </ul>
      <p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-gray-800">
        Envíala como header <code>X-API-Key</code> (o <code>Authorization: Bearer</code>) en cada petición.
      </p>
    </div>
  );
}

// --- Tab Mapeos: versiones + playground direccional (dry-run) ---
// Cada dirección tiene su propio ejemplo precargado Y recuerda lo que el
// partner escribe (drafts), para que alternar el toggle no "reinicie" nada.
const EXAMPLES = {
  inbound: {
    template: JSON.stringify(
      {
        externalId: "id",
        point: {
          type: { $literal: "offer_help" },
          title: "titulo",
          description: "desc",
          helpTypeName: { $literal: "Donaciones" },
          locations: [
            {
              type: { $literal: "origin" },
              lat: 4.711,
              lng: -74.07,
              city: "origen.ciudad",
              neighborhood: "'Centro'",
              address: "origen.direccion",
            },
          ],
          contacts: [{ type: { $literal: "phone" }, value: "tel" }],
        },
      },
      null,
      2,
    ),
    input: JSON.stringify(
      {
        id: "punto-123",
        titulo: "Comedor comunitario la Esperanza",
        desc: "Entregamos almuerzos calientes de lunes a viernes.",
        origen: { direccion: "Cra 7 #71-21", ciudad: "Bogotá" },
        tel: "3001112233",
      },
      null,
      2,
    ),
  },
  outbound: {
    template: JSON.stringify(
      {
        location: {
          origin: "$join($map(point.locations[type='origin'], function($l){ $l.address }), ',')",
          destination: "$join($map(point.locations[type='destination'], function($l){ $l.address }), ',')",
          city: "point.locations[0].city",
        },
        description: "point.description",
        esNuevo: "event = 'point_created' ? true : false",
      },
      null,
      2,
    ),
    input: JSON.stringify(
      {
        event: "point_created",
        point: {
          code: "AB12CD34",
          title: "Centro de acopio norte",
          description: "Recibimos comida no perecedera y agua.",
          locations: [
            { type: "origin", address: "Cra 7 #71-21", city: "Bogotá" },
            { type: "destination", address: "Calle 100", city: "Bogotá" },
          ],
          contacts: [{ type: "whatsapp", value: "3001234567" }],
        },
        source: { app: "ayudaporcolombia", code: "AB12CD34" },
      },
      null,
      2,
    ),
  },
} as const;

type Direction = "inbound" | "outbound";

function MapeosTab() {
  const [mappings, setMappings] = useState<PartnerMappingView[]>([]);
  const [direction, setDirection] = useState<Direction>("inbound");
  const [drafts, setDrafts] = useState<Record<Direction, { template: string; input: string }>>({
    inbound: { template: EXAMPLES.inbound.template, input: EXAMPLES.inbound.input },
    outbound: { template: EXAMPLES.outbound.template, input: EXAMPLES.outbound.input },
  });
  const draft = drafts[direction];
  const setDraft = (patch: Partial<{ template: string; input: string }>) =>
    setDrafts((prev) => ({ ...prev, [direction]: { ...prev[direction], ...patch } }));
  const [result, setResult] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ ok: boolean; valid?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMappings(await partnerApi.mappings());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando mapeos");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function parseJson(text: string, what: string): unknown | null {
    try {
      return JSON.parse(text);
    } catch (e) {
      setError(`${what}: JSON inválido (${e instanceof Error ? e.message : e})`);
      return null;
    }
  }

  async function dryRun() {
    setError(null);
    setResult(null);
    setResultMeta(null);
    const def = parseJson(draft.template, "definition");
    const input = parseJson(draft.input, "sampleInput");
    if (def == null || input == null) return;
    setBusy(true);
    try {
      const res = await partnerApi.dryRun({ direction, definition: def, sampleInput: input });
      setResult(JSON.stringify(res, null, 2));
      setResultMeta({ ok: res.ok, valid: res.canonicalCheck?.valid });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en dry-run");
    } finally {
      setBusy(false);
    }
  }

  async function saveAndActivate() {
    setError(null);
    setResult(null);
    setResultMeta(null);
    const def = parseJson(draft.template, "definition");
    if (def == null) return;
    setBusy(true);
    try {
      await partnerApi.createMapping({ direction, definition: def, activate: true });
      load();
      setResult("Mapeo guardado y ACTIVADO (la versión anterior queda como rollback).");
      setResultMeta({ ok: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando mapeo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjeta: Versiones */}
      <div className={cardCls}>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <SectionTitle icon={Settings2}>Versiones activas</SectionTitle>
        </div>
        <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
          {mappings.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <Badge tone={m.direction === "inbound" ? "sky" : "gray"}>{m.direction}</Badge>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">v{m.version}</span>
                  {m.isActive && (
                    <Badge tone="green">
                      <Dot /> activo
                    </Badge>
                  )}
                </p>
                {m.notes && <p className="mt-0.5 truncate text-xs text-gray-400">{m.notes}</p>}
              </div>
              {!m.isActive && (
                <button
                  onClick={async () => {
                    try {
                      await partnerApi.activateMapping(m.id);
                      load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Error activando");
                    }
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300"
                >
                  <Undo2 className="h-3 w-3" /> Activar v{m.version}
                </button>
              )}
            </li>
          ))}
          {mappings.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">
              Sin mapeos: se usa el contrato genérico documentado en la guía.
            </li>
          )}
        </ul>
      </div>

      {/* Referencia de enums/valores según la dirección */}
      <MappingReference direction={direction} />

      {/* Tarjeta: Playground */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <SectionTitle icon={Settings2}>Playground · dry-run sin guardar</SectionTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-[11px] font-bold dark:bg-gray-800">
              {(["inbound", "outbound"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDirection(d);
                    setResult(null);
                    setResultMeta(null);
                    setError(null);
                  }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 uppercase tracking-wide ${direction === d ? "bg-white shadow dark:bg-gray-950 dark:text-white" : "text-gray-500"}`}
                >
                  {d === "inbound" ? (
                    <>
                      <ArrowLeft className="h-3 w-3" /> inbound
                    </>
                  ) : (
                    <>
                      outbound <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft({ template: EXAMPLES[direction].template, input: EXAMPLES[direction].input });
                setResult(null);
                setResultMeta(null);
                setError(null);
              }}
              title="Restaura el ejemplo de esta dirección"
              className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 dark:border-gray-600"
            >
              <RotateCcw className="h-3 w-3" /> ejemplo
            </button>
          </div>
        </div>
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
          {direction === "inbound"
            ? "Tu payload → tu plantilla → el canónico que entra a nuestro sistema (siempre validado)."
            : "Nuestro sobre → tu plantilla → el JSON que recibirá tu webhook."}
        </p>

        {/* Pipeline 1 → 2 → 3 con flechas (apilado en móvil) */}
        <div className="grid items-stretch gap-3 p-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="flex min-w-0 flex-col">
            <StepHeader n={1} color="bg-sky-500" label={direction === "inbound" ? "Tu payload" : "Sobre canónico"} />
            <JsonTextarea value={draft.input} onChange={(v) => setDraft({ input: v })} ariaLabel="Input" />
          </div>
          <ArrowRight className="hidden h-4 w-4 self-center text-gray-300 lg:block" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <StepHeader n={2} color="bg-brand" label="Tu plantilla (JSONata)" />
            <JsonTextarea value={draft.template} onChange={(v) => setDraft({ template: v })} ariaLabel="Plantilla" />
          </div>
          <ArrowRight className="hidden h-4 w-4 self-center text-gray-300 lg:block" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <StepHeader
              n={3}
              color="bg-emerald-500"
              label={direction === "inbound" ? "Canónico resultante" : "Tu formato resultante"}
              pill={
                resultMeta ? (
                  resultMeta.ok && resultMeta.valid !== false ? (
                    <Badge tone="green">
                      <CheckCircle2 className="h-3 w-3" /> válido
                    </Badge>
                  ) : (
                    <Badge tone="red">
                      <XCircle className="h-3 w-3" /> con errores
                    </Badge>
                  )
                ) : undefined
              }
            />
            {result ? (
              <JsonView value={result} className="h-[calc(100%-1.5rem)] max-h-[30rem]" />
            ) : (
              <div className="flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400 dark:border-gray-700">
                {direction === "inbound"
                  ? "Esto entrará a nuestro sistema (pasa la validación canónica)."
                  : "Esto recibirá tu webhook en tu propio formato."}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            onClick={dryRun}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" /> Probar (dry-run)
          </button>
          <button
            onClick={saveAndActivate}
            disabled={busy}
            className="rounded-md border border-emerald-300 px-3.5 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60 dark:border-emerald-700"
          >
            Guardar y activar ({direction})
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
          <p className="w-full text-xs text-gray-400">
            Sin mapeo activo se aplica el contrato genérico · guía: <code>Mapeos por expresiones (JSONata).md</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// Referencia de campos y valores permitidos según la dirección del playground:
// qué enums existen y dónde. Colapsable para no robar espacio de trabajo.
function MappingReference({ direction }: { direction: Direction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${cardCls} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <SectionTitle icon={Info}>
          {direction === "inbound"
            ? "Valores permitidos · objetivo canónico (inbound)"
            : "Valores permitidos · sobre que recibirás (outbound)"}
        </SectionTitle>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <dl className="divide-y divide-gray-100 border-t border-gray-100 px-4 py-1 dark:divide-gray-800 dark:border-gray-800">
          <RefRow
            k={direction === "inbound" ? "point.type" : "event"}
            values={
              direction === "inbound"
                ? ["need_help", "offer_help"]
                : ["point_created", "point_updated"]
            }
            hint={direction === "inbound" ? "necesita ayuda / ofrece ayuda" : "nuevo o publicado / actualizado"}
          />
          {direction === "outbound" && (
            <>
              <RefRow
                k="point.status"
                values={["pending", "active", "resolved", "cancelled", "expired", "rejected"]}
                hint="active/resolved visibles; el resto ya no"
              />
              <RefRow
                k="point.verificationStatus"
                values={["pending", "approved", "rejected"]}
                hint="sello de moderación"
              />
            </>
          )}
          <RefRow
            k="point.locations[].type"
            values={["location", "origin", "destination"]}
            hint="punto único / partida / destino"
          />
          <RefRow
            k="point.contacts[].type"
            values={["phone", "whatsapp", "instagram", "email", "other"]}
          />
          <RefRow
            k="expiresAt"
            values={["2026-12-31T00:00:00.000Z"]}
            hint="ISO-8601 (opcional)"
            mono
          />
          {direction === "inbound" ? (
            <div className="py-2 text-[11px] leading-relaxed text-gray-400">
              Límites de validación: title 3–200 · description 10–5000 · 1–5 locations · hasta 10
              contacts (offer_help exige 1) · hasta 30 supplies.
            </div>
          ) : (
            <div className="py-2 text-[11px] leading-relaxed text-gray-400">
              Otros campos del sobre: <code>point.id · point.code · point.title · point.description ·
              point.helpTypeName · point.photos[] · point.createdAt · point.updatedAt ·
              source.{"{"}app,id,code,url{"}"}</code>. Nunca enviamos email del creador ni contactos
              privados.
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function RefRow({ k, values, hint, mono }: { k: string; values: string[]; hint?: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
      <dt className="w-full font-mono text-[11px] font-semibold text-gray-500 sm:w-56">{k}</dt>
      <dd className="flex flex-wrap items-center gap-1">
        {values.map((v) => (
          <code
            key={v}
            className={`rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${mono ? "font-mono" : ""}`}
          >
            {v}
          </code>
        ))}
        {hint && <span className="text-[11px] text-gray-400">— {hint}</span>}
      </dd>
    </div>
  );
}

// Cabecera de paso del pipeline: número en círculo de color + etiqueta (+pill).
function StepHeader({ n, color, label, pill }: { n: number; color: string; label: string; pill?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${color}`}>
        {n}
      </span>
      <span className="truncate text-xs font-semibold text-gray-500">{label}</span>
      {pill}
    </div>
  );
}

// --- Tab Entregas: webhooks que les hemos enviado (estado y reintentos) ---
function EntregasTab() {
  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDeliveries(await partnerApi.deliveries());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando entregas");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const badge = (status: string) => {
    const map: Record<string, keyof typeof TONES> = {
      delivered: "green",
      failed: "red",
      pending: "amber",
      processing: "sky",
      skipped: "gray",
    };
    return <Badge tone={map[status] ?? "gray"}>{status}</Badge>;
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <SectionTitle icon={Activity}>Últimas entregas a tu webhook</SectionTitle>
        <button
          onClick={load}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 dark:border-gray-600"
        >
          <RotateCcw className="h-3 w-3" /> Refrescar
        </button>
      </div>
      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
        {deliveries.map((d) => (
          <li key={d.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                {d.point?.code ?? d.id.slice(0, 8)}
                {d.point?.title ? <span className="ml-2 font-sans font-normal text-gray-400">{d.point.title}</span> : null}
              </span>
              {badge(d.status)}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {d.event === "point_created" ? "creación" : "actualización"} · HTTP {d.httpStatus ?? "—"} ·{" "}
              {d.attempts} intento{d.attempts !== 1 ? "s" : ""} · {new Date(d.createdAt).toLocaleString()}
            </p>
            {d.lastError && (
              <p className="mt-1 rounded-md bg-red-50 px-2 py-1 font-mono text-[11px] text-red-600 dark:bg-red-950/40">
                {d.lastError}
              </p>
            )}
          </li>
        ))}
        {deliveries.length === 0 && (
          <li className="px-4 py-4 text-sm text-gray-400">
            Sin entregas todavía — configura tu webhook en “Estado” y un moderador activará el envío.
          </li>
        )}
      </ul>
    </div>
  );
}





