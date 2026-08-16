// Candidatos de ubicación tras una tool call "buscar_lugar": la persona elige
// uno con un tap (el marcador aparece en el mapa en vivo) o prefiere marcarlo
// directamente en el mapa. Nunca se auto-marca: un tap de confirmación evita
// puntos en el lugar equivocado.

import { MapPin } from "lucide-react";
import type { AddressResult } from "../../AddressSearch";

interface LocationProposalProps {
  query?: string;
  candidates: AddressResult[];
  onPick: (r: AddressResult) => void;
  onMarkMap: () => void;
}

export function LocationProposal({ query, candidates, onPick, onMarkMap }: LocationProposalProps) {
  return (
    <div className="shrink-0 px-4 pb-2">
      <div className="rounded-md border border-brand/40 bg-brand/5 p-3 dark:border-brand/40 dark:bg-brand/10">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-dark dark:text-brand">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {candidates.length === 1
            ? "Confirma el lugar que encontré"
            : query
              ? `Encontré ${candidates.length} lugares para «${query}»`
              : `Encontré ${candidates.length} lugares`}
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {candidates.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:border-brand hover:bg-brand/5 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onMarkMap}
          className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Prefiero marcarlo en el mapa
        </button>
      </div>
    </div>
  );
}
