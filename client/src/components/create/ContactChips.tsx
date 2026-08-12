import { useState } from "react";
import { CONTACT_LABELS, CONTACT_TYPES, type ContactInfo, type ContactType } from "../../types";

// Icono por tipo de contacto (unicode/emoji para no añadir dependencias).
export const CONTACT_ICON: Record<ContactType, string> = {
  phone: "📞",
  whatsapp: "💬",
  instagram: "📸",
  email: "✉️",
  other: "＃",
};

interface ContactChipsProps {
  contacts: ContactInfo[];
  onAdd: (type: ContactType, value: string) => void;
  onRemove: (index: number) => void;
}

// Selector de contactos: un mini-form (tipo + valor) con botón "Añadir" que
// agrega el contacto como un chip borrable debajo.
export function ContactChips({ contacts, onAdd, onRemove }: ContactChipsProps) {
  const [type, setType] = useState<ContactType>("phone");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const v = value.trim();
    if (!v) {
      setErr("Escribe el contacto antes de añadirlo");
      return;
    }
    onAdd(type, v);
    setValue("");
    setErr(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ContactType)}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            {CONTACT_TYPES.map((v) => (
              <option key={v} value={v}>
                {CONTACT_ICON[v]} {CONTACT_LABELS[v]}
              </option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (err) setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={
              type === "phone" || type === "whatsapp" ? "+57 300 1234567" : "@usuario o correo"
            }
          />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button
          type="button"
          onClick={add}
          className="self-start rounded-md bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand/20"
        >
          + Añadir contacto
        </button>
      </div>

      {contacts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {contacts.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-2.5 pr-1.5 text-sm"
            >
              <span aria-hidden>{CONTACT_ICON[c.type]}</span>
              <span className="text-gray-700">{c.value}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Quitar contacto"
                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">Aún no has añadido contactos.</p>
      )}
    </div>
  );
}
