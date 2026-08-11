import { useState } from "react";

export interface AddressResult {
  lat: number;
  lng: number;
  label: string;
}

interface AddressSearchProps {
  onSelect: (result: AddressResult) => void;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        format: "json",
        limit: "5",
        countrycodes: "co",
        q,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as NominatimResult[];
      setResults(
        data.map((item) => ({
          lat: Number(item.lat),
          lng: Number(item.lon),
          label: item.display_name,
        })),
      );
      if (data.length === 0) setError("No encontramos esa dirección en Colombia.");
    } catch {
      setError("No pudimos buscar la dirección. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Busca una dirección (ej. Calle 10 #5-20, Armenia)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-md bg-gray-800 text-white px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-1 border border-gray-200 rounded-md divide-y divide-gray-100 max-h-40 overflow-y-auto">
          {results.map((result, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(result);
                  setResults([]);
                  setQuery(result.label);
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
