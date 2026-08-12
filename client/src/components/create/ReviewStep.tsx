import type { ReactNode } from "react";
import {
  CONTACT_LABELS,
  type ContactInfo,
  type HelpTypeOption,
  type LocationDraft,
  type PointType,
  type SupplyDraft,
} from "../../types";
import { CONTACT_ICON } from "./ContactChips";

interface ReviewStepProps {
  type: PointType;
  title: string;
  description: string;
  helpType: HelpTypeOption;
  supplies: SupplyDraft[];
  locations: LocationDraft[];
  contacts: ContactInfo[];
  photosCount: number;
  needsLogin: boolean;
  submitting: boolean;
  error: string | null;
  onLogin: () => void;
}

const TYPE_LABEL: Record<PointType, string> = {
  offer_help: "Punto de ayuda",
  need_help: "Necesitamos ayuda",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

// Paso final: resumen de solo lectura + aviso de login si corresponde.
// El botón Publicar vive en el pie del asistente; aquí mostramos el resumen.
export function ReviewStep({
  type,
  title,
  description,
  helpType,
  supplies,
  locations,
  contacts,
  photosCount,
  needsLogin,
  error,
  onLogin,
}: ReviewStepProps) {
  const placed = locations.filter((l) => l.lat != null && l.lng != null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Revisa que todo esté correcto. Al publicar{" "}
        <strong className="text-gray-700">
          {type === "offer_help"
            ? "se enviará a revisión antes de aparecer en el mapa."
            : "aparecerá de inmediato, marcado como no verificado."}
        </strong>
      </p>

      <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-3">
        <Row label="Tipo">{TYPE_LABEL[type]}</Row>
        <Row label="Título">{title || "—"}</Row>
        <Row label="Descripción">
          <span className="whitespace-pre-wrap">{description || "—"}</span>
        </Row>
        <Row label="Tipo de ayuda">{helpType}</Row>
        <Row label="Acepta/ofrece">
          {supplies.filter((s) => s.name.trim().length >= 2).length === 0 ? (
            <span className="text-gray-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {supplies
                .filter((s) => s.name.trim().length >= 2)
                .map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand-dark"
                  >
                    {s.name}
                    {s.targetQuantity ? ` (${s.targetQuantity}${s.unit ? " " + s.unit : ""})` : ""}
                  </span>
                ))}
            </div>
          )}
        </Row>
        <Row label="Ubicaciones">
          {placed.length === 0 ? (
            <span className="text-red-600">Sin marcar</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {placed.map((l, i) => (
                <li key={i}>
                  <span className="text-gray-500">{l.type}:</span>{" "}
                  {l.addressText || `${l.lat!.toFixed(4)}, ${l.lng!.toFixed(4)}`}
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Contactos">
          {contacts.length === 0 ? (
            <span className="text-red-600">Sin contactos</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {contacts.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                >
                  {CONTACT_ICON[c.type]} {CONTACT_LABELS[c.type]}: {c.value}
                </span>
              ))}
            </div>
          )}
        </Row>
        <Row label="Fotos">{photosCount}</Row>
      </dl>

      {needsLogin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>
            Para publicar un punto de ayuda necesitas iniciar sesión.{" "}
            <strong>Guardaremos todo lo que ya llenaste</strong> para que no pierdas nada al volver.{" "}
            <button type="button" onClick={onLogin} className="font-semibold underline">
              Ir a iniciar sesión
            </button>
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
