import { DEFAULT_SUPPLIES, SUPPLY_UNITS, type SupplyDraft } from "../../types";

interface SupplyPickerProps {
  // Suministros seleccionados (la fuente de verdad). El nombre actúa como clave.
  supplies: SupplyDraft[];
  onChange: (next: SupplyDraft[]) => void;
}

function isOther(s: SupplyDraft): boolean {
  return !DEFAULT_SUPPLIES.includes(s.name as (typeof DEFAULT_SUPPLIES)[number]);
}

// Selector de suministros por checkboxes (relación M:N PointSupply):
// - Cada checkbox del catálogo añade/quita un suministro.
// - Al marcar, aparece una fila con cantidad "esperada" (opcional) + unidad.
// - "Otro" revela un input de texto libre para el nombre (más su cantidad).
export function SupplyPicker({ supplies, onChange }: SupplyPickerProps) {
  const checkedNames = new Set(supplies.map((s) => s.name));
  const otherEntry = supplies.find(isOther);

  function setQty(name: string, patch: Partial<SupplyDraft>) {
    onChange(supplies.map((s) => (s.name === name ? { ...s, ...patch } : s)));
  }
  function toggle(name: string) {
    if (checkedNames.has(name)) {
      onChange(supplies.filter((s) => s.name !== name));
    } else {
      onChange([...supplies, { name, targetQuantity: null, unit: null }]);
    }
  }
  function setOtherName(value: string) {
    const v = value.trim();
    if (otherEntry) {
      if (!v) {
        onChange(supplies.filter((s) => s !== otherEntry));
      } else {
        onChange(supplies.map((s) => (s === otherEntry ? { ...s, name: v } : s)));
      }
    } else if (v) {
      onChange([...supplies, { name: v, targetQuantity: null, unit: null }]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-1">
        {DEFAULT_SUPPLIES.map((name) => {
          const checked = checkedNames.has(name);
          const entry = supplies.find((s) => s.name === name);
          return (
            <div key={name}>
              <label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(name)}
                  className="h-4 w-4 accent-[#1d6f5c]"
                />
                <span className="text-gray-700">{name}</span>
              </label>
              {checked && entry && (
                <QtyRow
                  targetQuantity={entry.targetQuantity ?? null}
                  unit={entry.unit ?? null}
                  onChange={(patch) => setQty(name, patch)}
                />
              )}
            </div>
          );
        })}

        {/* Otro: checkbox que revela un input de texto libre */}
        <div>
          <label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
            <input
              type="checkbox"
              checked={!!otherEntry}
              onChange={() => {
                if (otherEntry) onChange(supplies.filter((s) => s !== otherEntry));
                else onChange([...supplies, { name: "", targetQuantity: null, unit: null }]);
              }}
              className="h-4 w-4 accent-[#1d6f5c]"
            />
            <span className="text-gray-700">Otro</span>
          </label>
          {otherEntry && (
            <div className="ml-6 mt-1">
              <input
                value={otherEntry.name}
                onChange={(e) => setOtherName(e.target.value)}
                maxLength={80}
                placeholder="Especifica el suministro"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <div className="mt-1">
                <QtyRow
                  targetQuantity={otherEntry.targetQuantity ?? null}
                  unit={otherEntry.unit ?? null}
                  onChange={(patch) =>
                    onChange(supplies.map((s) => (s === otherEntry ? { ...s, ...patch } : s)))
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {supplies.length === 0 && (
        <p className="text-xs text-gray-400">
          Opcional: marca lo que aceptas u ofreces y, si quieres, una cantidad esperada.
        </p>
      )}
    </div>
  );
}

// Fila compacta de cantidad esperada (opcional) + unidad.
function QtyRow({
  targetQuantity,
  unit,
  onChange,
}: {
  targetQuantity: number | null;
  unit: string | null;
  onChange: (patch: Partial<SupplyDraft>) => void;
}) {
  return (
    <div className="ml-6 mb-1 flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={targetQuantity ?? ""}
        onChange={(e) =>
          onChange({ targetQuantity: e.target.value === "" ? null : Number(e.target.value) })
        }
        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        placeholder="Esperado"
      />
      <select
        value={unit ?? ""}
        onChange={(e) => onChange({ unit: e.target.value || null })}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="">Unidad</option>
        {SUPPLY_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-gray-400">opcional</span>
    </div>
  );
}
