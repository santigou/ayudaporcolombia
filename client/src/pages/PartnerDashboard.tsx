import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

// Dashboard del partner (entra con su API key, guardada en localStorage):
// estado del partnership, gestión de keys, editor de mapeos con playground
// dry-run y últimas entregas (webhooks) recibidas.
export function PartnerDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState<PartnerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"estado" | "keys" | "mapeos" | "entregas">("estado");

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
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => { setError(null); reload(); }} className="mt-2 rounded-md border px-3 py-1.5 text-sm">
          Reintentar
        </button>
      </div>
    );
  }
  if (!me) {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-gray-500">Cargando partnership…</div>;
  }

  const tabs = [
    ["estado", "Estado"],
    ["keys", "API keys"],
    ["mapeos", "Mapeos"],
    ["entregas", "Entregas"],
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{me.name}</h1>
            <p className="font-mono text-xs text-gray-500">@{me.slug}</p>
          </div>
          <button onClick={logout} className="rounded-md border px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
            Salir
          </button>
        </div>

        {/* Estado resumido siempre visible */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {me.approvedAt ? (
            <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
              Aprobado ✓
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Pendiente de aprobación
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {me.trusted ? "trusted (publicación inmediata)" : "no trusted (pasa por moderación)"}
          </span>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border px-3 py-1 text-gray-600 underline dark:text-gray-300"
          >
            Swagger /api/docs
          </a>
        </div>
        {!me.approvedAt && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Tu API key aún <strong>no puede enviar puntos</strong>. Un moderador revisará el
            registro (contacto: {me.contactEmail ?? "—"}). Mientras tanto puedes preparar tus
            mapeos y probarlos con el playground.
          </p>
        )}

        <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${tab === id ? "bg-white shadow dark:bg-gray-900" : "text-gray-500"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "estado" && <EstadoTab me={me} />}
        {tab === "keys" && <KeysTab onChanged={reload} />}
        {tab === "mapeos" && <MapeosTab />}
        {tab === "entregas" && <EntregasTab />}

        <p className="mt-8 text-xs text-gray-400">
          <Link to="/" className="underline">Volver al mapa</Link> ·{" "}
          <Link to="/partners/guia" className="underline">Guía de integración</Link> · docs:{" "}
          Integraciones partner.md / Mapeos por expresiones (JSONata).md
        </p>
      </div>
    </div>
  );
}

// --- Tab Estado: configuración actual del partnership (secrets enmascarados) ---
function EstadoTab({ me }: { me: PartnerView }) {
  const rows: Array<[string, string]> = [
    ["Contacto", me.contactEmail ?? "—"],
    ["Registrado", new Date(me.createdAt).toLocaleString()],
    ["Aprobado", me.approvedAt ? new Date(me.approvedAt).toLocaleString() : "pendiente"],
    ["Enviar puntos (inbound)", me.inboundEnabled ? "habilitado" : "deshabilitado"],
    ["Recibir webhooks (outbound)", me.outboundEnabled ? `→ ${me.outboundUrl ?? "sin URL"}` : "deshabilitado"],
    ["Auth outbound", me.outboundEnabled ? `${me.authType}${me.authType === "api_key" ? ` (${me.outboundHeaderName ?? "X-API-Key"}: ${me.outboundApiKey ?? "—"})` : ` (${me.loginEmail ?? "—"})`}` : "—"],
  ];
  return (
    <dl className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-gray-500">{k}</dt>
          <dd className="text-right font-medium text-gray-800 dark:text-gray-200">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- Tab API keys: listar / emitir (mostrada UNA vez) / revocar ---
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
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          El valor completo solo se muestra al emitirla.
        </p>
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
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          + Nueva key
        </button>
      </div>

      {newKey && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Guárdala AHORA (no volverá a mostrarse):
          </p>
          <code className="mt-1 block break-all font-mono text-sm text-amber-900 dark:text-amber-200">{newKey}</code>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div>
              <p className="font-mono">{k.prefix}…</p>
              <p className="text-xs text-gray-400">
                {k.name} · {k.revokedAt ? "revocada" : k.lastUsedAt ? `usada ${new Date(k.lastUsedAt).toLocaleString()}` : "sin uso"}
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
                className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 dark:border-red-800"
              >
                Revocar
              </button>
            )}
          </li>
        ))}
        {keys.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Sin keys.</li>}
      </ul>
    </div>
  );
}

// --- Tab Mapeos: versiones + playground dry-run (plantilla + input → resultado) ---
const EXAMPLE_TEMPLATE = JSON.stringify(
  {
    location: {
      origin: "$join($map(point.locations[type='origin'], function($l){ $l.address }), ',')",
      destination: "$join($map(point.locations[type='destination'], function($l){ $l.address }), ',')",
    },
    description: "point.description",
  },
  null,
  2,
);
const EXAMPLE_INPUT = JSON.stringify(
  {
    event: "point_created",
    point: {
      description: "Centro de acopio zona norte",
      locations: [
        { type: "origin", address: "Calle 1" },
        { type: "destination", address: "Calle 2" },
      ],
    },
  },
  null,
  2,
);

function MapeosTab() {
  const [mappings, setMappings] = useState<PartnerMappingView[]>([]);
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [template, setTemplate] = useState(EXAMPLE_TEMPLATE);
  const [sample, setSample] = useState(EXAMPLE_INPUT);
  const [result, setResult] = useState<string | null>(null);
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
    const def = parseJson(template, "definition");
    const input = parseJson(sample, "sampleInput");
    if (def == null || input == null) return;
    setBusy(true);
    try {
      const res = await partnerApi.dryRun({ direction, definition: def, sampleInput: input });
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en dry-run");
    } finally {
      setBusy(false);
    }
  }

  async function saveAndActivate() {
    setError(null);
    setResult(null);
    const def = parseJson(template, "definition");
    if (def == null) return;
    setBusy(true);
    try {
      await partnerApi.createMapping({ direction, definition: def, activate: true });
      load();
      setResult("✓ Mapeo guardado y ACTIVADO (la versión anterior queda como rollback).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando mapeo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {/* Versiones existentes */}
      <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Versiones</h2>
      <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-700">
        {mappings.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p>
                <span className="font-mono text-xs uppercase text-gray-400">{m.direction}</span>{" "}
                v{m.version} {m.isActive && <strong className="text-green-600">· activo</strong>}
              </p>
              <p className="text-xs text-gray-400">{m.notes ?? ""}</p>
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
                className="rounded-md border px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                Activar (rollback a v{m.version})
              </button>
            )}
          </li>
        ))}
        {mappings.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">
            Sin mapeos: se usa el contrato genérico documentado.
          </li>
        )}
      </ul>
      {/* Playground */}
      <h2 className="mt-6 text-sm font-bold text-gray-800 dark:text-gray-200">
        Playground (dry-run sin guardar)
      </h2>
      <div className="mt-2 flex gap-1 rounded-lg bg-gray-100 p-1 text-xs dark:bg-gray-800">
        {(["inbound", "outbound"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-md px-3 py-1 font-semibold uppercase ${direction === d ? "bg-white shadow dark:bg-gray-900" : "text-gray-500"}`}
          >
            {d === "inbound" ? "tu payload → canónico" : "canónico → tu formato"}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-gray-500">
          Plantilla (hojas = expresiones JSONata)
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
            rows={14}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Input de ejemplo {direction === "inbound" ? "(tu payload real)" : "(sobre canónico)"}
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            spellCheck={false}
            rows={14}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={dryRun}
          disabled={busy}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Probar (dry-run)
        </button>
        <button
          onClick={saveAndActivate}
          disabled={busy}
          className="rounded-md border border-green-300 px-3 py-1.5 text-sm font-semibold text-green-700 disabled:opacity-60 dark:border-green-700"
        >
          Guardar y activar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-xs text-green-300">
          {result}
        </pre>
      )}
      <p className="mt-2 text-xs text-gray-400">
        Guía de expresiones: docs/obsidian/Mapeos por expresiones (JSONata).md
      </p>
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
    const colors: Record<string, string> = {
      delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      skipped: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    };
    return `rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? colors.skipped}`;
  };

  return (
    <div className="mt-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-700">
        {deliveries.map((d) => (
          <li key={d.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{d.point?.code ?? d.id.slice(0, 8)}</span>
              <span className={badge(d.status)}>{d.status}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {d.event} · HTTP {d.httpStatus ?? "—"} · intentos {d.attempts} ·{" "}
              {new Date(d.createdAt).toLocaleString()}
            </p>
            {d.lastError && <p className="mt-0.5 text-xs text-red-500">{d.lastError}</p>}
          </li>
        ))}
        {deliveries.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">
            Sin entregas todavía (activa el outbound de tu partnership para recibirlas).
          </li>
        )}
      </ul>
    </div>
  );
}


