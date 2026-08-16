import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { partnerApi, setPartnerKey } from "../api/partner";

// Guía pública paso a paso: cómo integrar una app de ayuda con nosotros.
// Es la página que le compartes a otro equipo para que se integren solos:
// registro → aprobación → primer punto → mapeos → webhooks → monitoreo.

function CodeBlock({ title, code }: { title?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-400">{title ?? "ejemplo"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard no disponible */
            }
          }}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-800"
        >
          <Copy className="h-3 w-3" /> {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-green-300">{code}</pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-12 pb-8 last:pb-0">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {n}
      </span>
      {n < 7 && <span className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-gray-200 dark:bg-gray-700" />}
      <h3 className="pt-1 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{children}</div>
    </li>
  );
}

export function PartnersGuide() {
  const [apiKey, setApiKey] = useState("");

  // Base pública de la API para los ejemplos copiables: env VITE_API_URL o,
  // por defecto, el origen actual (en dev lo proxya Vite; en prod es same-origin).
  const apiBase = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, "");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Para equipos de otras apps</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
          Integra tu app de ayuda en 6 pasos
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Federamos puntos de ayuda: tú nos envías los tuyos por API y nosotros te enviamos los
          nuestros por webhook. Sin cambiar tu modelo de datos: si tu formato es distinto, se adapta
          con mapeos declarativos. Los ejemplos de abajo ya apuntan a{" "}
          <code>{apiBase}</code> — cópialos y funcionan tal cual. Todo el detalle técnico está en{" "}
          <a href="/api/docs" target="_blank" rel="noreferrer" className="font-medium text-brand underline">
            /api/docs (Swagger)
          </a>
          .
        </p>

        <ol className="mt-8 list-none">
          <Step n={1} title="Registra tu app y obtén tu API key">
            <p>
              Ve al{" "}
              <Link to="/partners" className="font-medium text-brand underline">
                portal de partners
              </Link>{" "}
              y registra tu app (nombre, identificador y correo de contacto). Recibirás tu{" "}
              <strong>API key</strong> (formato <code>apc_…</code>): se muestra{" "}
              <strong>una sola vez</strong>, guárdala bien. Puedes rotarla y revocarla desde el
              dashboard cuando quieras.
            </p>
          </Step>

          <Step n={2} title="Espera la aprobación (mientras, prepara todo)">
            <p>
              Un moderador revisa el registro y aprueba el partnership. Hasta entonces tu key{" "}
              <strong>no puede enviar puntos</strong>, pero sí puedes entrar al dashboard,
              configurar tus mapeos y probarlos con el playground. Para llamarnos usa el header:
            </p>
            <CodeBlock
              title="autenticación (elige una)"
              code={`X-API-Key: apc_tu_clave_aqui
# o igual con Bearer:
Authorization: Bearer apc_tu_clave_aqui`}
            />
          </Step>
          <Step n={3} title="Envía tu primer punto">
            <p>
              Haz <code>POST /api/integrations/v1/points</code> con tu key. Incluye{" "}
              <code>externalId</code> (el id del punto <em>en tu sistema</em>): es lo que nos hace
              idempotentes — reenviar lo mismo no duplica nada. Según tu partnership, el punto pasa
              por moderación o se publica directo.
            </p>
            <CodeBlock
              title="curl — contrato genérico"
              code={`curl -X POST ${apiBase}/api/integrations/v1/points \\
  -H "X-API-Key: apc_tu_clave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "punto-123",
    "point": {
      "type": "offer_help",
      "title": "Centro de acopio norte",
      "description": "Recibimos comida no perecedera y agua.",
      "helpTypeName": "Donaciones",
      "locations": [{ "lat": 4.711, "lng": -74.072, "city": "Bogotá", "neighborhood": "Chapinero" }],
      "contacts": [{ "type": "whatsapp", "value": "3001234567" }]
    }
  }'
# 201 {"code":"AB12CD34","status":"active"|"pending",...}`}
            />
            <CodeBlock
              title="JavaScript (fetch)"
              code={`await fetch("${apiBase}/api/integrations/v1/points", {
  method: "POST",
  headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ externalId: punto.id, point: canonical(punto) }),
});`}
            />
            <p>
              Consulta cómo quedó:{" "}
              <code>GET {`${apiBase}/api/integrations/v1/points/<externalId>/status`}</code>.
            </p>
          </Step>

          <Step n={4} title="¿Tu formato es distinto? Adáptalo con mapeos (opcional)">
            <p>
              Si no puedes emitir el contrato genérico, define un <strong>mapeo declarativo</strong>{" "}
              (JSON con expresiones JSONata) desde el dashboard y pruébalo con el playground antes
              de activarlo. Ejemplo para un formato <code>{`{ location: {...}, description }`}</code>:
            </p>
            <CodeBlock
              title="plantilla de mapeo (inbound: tu payload → nuestro canónico)"
              code={`{
  "externalId": "id",
  "point": {
    "type": { "$literal": "offer_help" },
    "title": "titulo",
    "description": "desc",
    "helpTypeName": { "$literal": "Donaciones" },
    "locations": [{ "lat": 4.711, "lng": -74.07, "city": "origen.ciudad", "address": "origen.direccion" }],
    "contacts": [{ "type": { "$literal": "phone" }, "value": "tel" }]
  }
}`}
            />
            <p>
              Guía completa de expresiones: <code>docs/obsidian/Mapeos por expresiones (JSONata).md</code>.
            </p>
          </Step>
          <Step n={5} title="Recibe nuestros puntos por webhook">
            <p>
              Cuando activen el outbound de tu partnership, te enviaremos un <code>POST</code> a la
              URL que nos indiques con los puntos nuevos y actualizados. Responde <code>2xx</code>{" "}
              para confirmar (reintentamos con backoff automático). En el body viene{" "}
              <code>source.app = "ayudaporcolombia"</code>: úsalo para ignorar ecos y no devolvernos
              puntos que ya son tuyos.
            </p>
            <CodeBlock
              title="lo que recibirás"
              code={`{
  "event": "point_created",
  "point": { "code": "AB12CD34", "type": "need_help", "title": "...", "locations": [...], "contacts": [...] },
  "source": { "app": "ayudaporcolombia", "id": "...", "code": "AB12CD34", "url": "https://.../p/AB12CD34" }
}`}
            />
          </Step>

          <Step n={6} title="Monitorea y itera">
            <p>
              En el dashboard ves tus <strong>entregas</strong> (estado de cada webhook, HTTP,
              reintentos) y el estado de tus puntos. Cambios de formato = nueva versión del mapeo
              con dry-run previo y rollback de un clic.
            </p>
          </Step>
        </ol>

        {/* CTA final + probador rápido */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Probador rápido</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Si ya tienes tu API key, verifica aquí mismo que es válida y en qué estado está tu
            partnership:
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="apc_tu_clave…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900"
            />
            <button
              type="button"
              onClick={async () => {
                setPartnerKey(apiKey.trim());
                try {
                  const me = await partnerApi.whoami();
                  alert(
                    `Key válida. Partner "${me.name}" (${me.slug}).` +
                      (me.approvedAt ? " Aprobado: ya puedes enviar puntos." : " PENDIENTE de aprobación: aún no puedes enviar puntos."),
                  );
                } catch (e) {
                  setPartnerKey(null);
                  alert("Key inválida: " + (e instanceof Error ? e.message : "revisa e inténtalo de nuevo"));
                }
              }}
              className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Probar key <ArrowRight className="inline h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            to="/partners"
            className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 font-semibold text-white"
          >
            Empezar: registrar mi app <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-gray-300 px-4 py-2 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            Ver Swagger completo
          </a>
        </div>

        <ul className="mt-8 space-y-1.5 text-xs text-gray-400 dark:text-gray-500">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Tus puntos pasan por moderación
            humana salvo partnership "trusted" acordado con el equipo.
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Nunca uses tu API key en
            código de navegador: es solo servidor-a-servidor.
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Reenviar el mismo payload es
            seguro: deduplicamos por externalId.
          </li>
        </ul>
      </div>
    </div>
  );
}
