import { AddressSearch, type AddressResult } from "../AddressSearch";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type LocationDraft,
  type PointLocationType,
} from "../../types";

// Color del punto según el rol (coincide con los marcadores del MapView).
const ROLE_COLOR: Record<PointLocationType, string> = {
  location: "#1d6f5c", // verde
  origin: "#2563eb", // azul
  destination: "#d97706", // ámbar
};

// Resumen en una línea para la caja cerrada.
function summarize(loc: LocationDraft): string {
  if (loc.addressText.trim()) return loc.addressText;
  if (loc.lat != null && loc.lng != null)
    return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  return "Sin marcar — toca el mapa o busca";
}

interface LocationAccordionProps {
  locations: LocationDraft[];
  activeIndex: number;
  openIndex: number | null;
  geoLoading: boolean;
  onOpen: (i: number) => void; // activa + expande esa caja
  onClose: () => void; // colapsa (mantiene la activa)
  onChange: (i: number, patch: Partial<LocationDraft>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onSearchSelect: (i: number, result: AddressResult) => void;
}

// Acordeón de ubicaciones: cada ubicación es una "caja". Cerrada muestra un
// resumen; abierta muestra el formulario completo. Solo puede haber una abierta
// a la vez. Soporta varias con rol (Ubicación/Origen/Destino), útil para
// need_help (p. ej. origen → destino).
export function LocationAccordion({
  locations,
  activeIndex,
  openIndex,
  geoLoading,
  onOpen,
  onClose,
  onChange,
  onAdd,
  onRemove,
  onSearchSelect,
}: LocationAccordionProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Toca el mapa o busca una dirección para marcar la ubicación activa (✎).
        Puedes añadir varias (p. ej. origen y destino).
      </p>

      {locations.map((loc, i) => {
        const isOpen = openIndex === i;
        const isActive = activeIndex === i;
        const placed = loc.lat != null && loc.lng != null;
        return (
          <div
            key={i}
            className={[
              "rounded-lg border bg-white",
              isActive ? "border-brand/60" : "border-gray-200",
              isOpen ? "ring-1 ring-brand/30" : "",
            ].join(" ")}
          >
            {/* Cabecera / resumen (botón para abrir o cerrar) */}
            <button
              type="button"
              onClick={() => (isOpen ? onClose() : onOpen(i))}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ROLE_COLOR[loc.type] }}
              />
              <span className="text-xs font-medium text-gray-500">
                {LOCATION_TYPE_LABELS[loc.type]}
              </span>
              {!isOpen && (
                <span className="flex-1 truncate text-sm text-gray-700">{summarize(loc)}</span>
              )}
              {isOpen && <span className="flex-1" />}
              <span
                className={`text-xs font-medium ${isActive ? "text-brand-dark" : "text-gray-400"}`}
              >
                {isOpen ? "Listo ▾" : isActive ? "Editando ✎" : "Editar ✎"}
              </span>
            </button>
            {/* Formulario completo de la caja abierta */}
            {isOpen && (
              <div className="flex flex-col gap-2 border-t border-gray-100 px-3 pb-3 pt-3">
                <div className="flex items-center gap-2">
                  <select
                    value={loc.type}
                    onChange={(e) =>
                      onChange(i, { type: e.target.value as PointLocationType })
                    }
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {LOCATION_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {LOCATION_TYPE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                  {locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="ml-auto rounded-md border border-gray-200 px-2 text-gray-500 hover:bg-gray-50"
                      aria-label="Quitar ubicación"
                    >
                      ×
                    </button>
                  )}
                </div>

                <AddressSearch onSelect={(r) => onSearchSelect(i, r)} />

                <input
                  value={loc.addressText}
                  onChange={(e) => onChange(i, { addressText: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Dirección o referencia (opcional)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={loc.city}
                    onChange={(e) => onChange(i, { city: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Ciudad"
                  />
                  <input
                    value={loc.neighborhood}
                    onChange={(e) => onChange(i, { neighborhood: e.target.value })}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Barrio"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  {isActive && geoLoading
                    ? "Obteniendo dirección…"
                    : placed
                      ? `Coordenadas: ${loc.lat!.toFixed(5)}, ${loc.lng!.toFixed(5)}`
                      : "Sin marcar — toca el mapa o busca una dirección."}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        + Añadir ubicación
      </button>
    </div>
  );
}
