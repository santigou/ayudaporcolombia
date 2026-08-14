import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MapView } from "../components/MapView";
import { PanicButton } from "../components/PanicButton";
import { FiltersBar } from "../components/FiltersBar";
import { PointList } from "../components/PointList";
import { PointDetail } from "../components/PointDetail";
import { HomeBottomSheet } from "../components/HomeBottomSheet";
import { useIsDesktop } from "../hooks/useIsDesktop";
import type { BBox, HelpTypeOption, Point, PointsResponse, PointType } from "../types";

// Normaliza texto para buscar sin distinguir mayúsculas ni acentos: así
// "búsqueda" coincide con "busqueda" y "Medellín" con "medellin".
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Concatena en un solo string todos los campos por los que queremos buscar de un
// punto. Se comparte una vez por punto y el filtro solo hace includes() por término.
function searchableText(p: Point): string {
  const loc = p.location;
  return normalize(
    [
      p.title,
      p.description,
      p.helpType ?? "",
      p.code,
      loc?.city ?? "",
      loc?.neighborhood ?? "",
      loc?.address ?? "",
      ...(p.supplies?.map((s) => s.name) ?? []),
    ].join(" "),
  );
}

export function Home() {
  const [points, setPoints] = useState<Point[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<PointType | "todos">("todos");
  const [helpType, setHelpType] = useState<HelpTypeOption | "todas">("todas");
  // Por defecto los resueltos no aparecen en el mapa (saturan sin aportar valor
  // inmediato); se incluyen si el usuario activa el toggle en FiltersBar.
  const [showResolved, setShowResolved] = useState(false);
  // Buscador de texto libre (filtra en el cliente sobre los puntos de la zona).
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Point | null>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);
  // Contador que se incrementa al crear un punto desde el botón de pánico para
  // forzar el refetch de la zona visible y mostrarlo de inmediato en el mapa.
  const [refreshTick, setRefreshTick] = useState(0);
  // Desktop: panel lateral derecho con detalle. Móvil: overlay (bottom-sheet).
  const isDesktop = useIsDesktop();

  // Reutiliza la última petición para descartar respuestas de bbox viejos (race).
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!bbox) return; // el mapa aún no reporta su zona visible
    const myId = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      minLat: String(bbox.minLat),
      maxLat: String(bbox.maxLat),
      minLng: String(bbox.minLng),
      maxLng: String(bbox.maxLng),
    });
    if (type !== "todos") params.set("type", type);

    api
      .get<PointsResponse>(`/points?${params.toString()}`)
      .then((data) => {
        if (cancelled || reqIdRef.current !== myId) return;
        setPoints(data.points);
        setTruncated(data.truncated);
        setError(null);
      })
      .catch(() => {
        if (cancelled || reqIdRef.current !== myId) return;
        setError("No pudimos cargar los puntos. Intenta de nuevo.");
      })
      .finally(() => {
        if (cancelled || reqIdRef.current !== myId) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, type, refreshTick]);

  // El filtro por tipo de ayuda es en el cliente (el catálogo es libre). También
  // ocultamos los resueltos salvo que el toggle esté activo y aplicamos el
  // buscador de texto (todos los términos deben aparecer en la info del punto).
  // Pre-normalizamos el texto buscable de cada punto una sola vez por carga.
  const searchable = useMemo(() => points.map((p) => ({ p, text: searchableText(p) })), [points]);
  const terms = useMemo(
    () => query.trim().split(/[\s+]+/).map(normalize).filter(Boolean),
    [query],
  );

  const filteredPoints = useMemo(() => {
    let out = points;
    if (!showResolved) out = out.filter((p) => p.status !== "resolved");
    if (type === "offer_help" && helpType !== "todas") {
      out = out.filter((p) => p.helpType === helpType);
    }
    if (terms.length > 0) {
      const matchById = new Set(
        searchable.filter(({ text }) => terms.every((t) => text.includes(t))).map(({ p }) => p.id),
      );
      out = out.filter((p) => matchById.has(p.id));
    }
    return out;
  }, [points, type, helpType, showResolved, terms, searchable]);

  // Cuántos resueltos hay ocultos actualmente (para la etiqueta del toggle).
  const resolvedHiddenCount = useMemo(() => {
    if (showResolved) return 0;
    return points.filter((p) => p.status === "resolved").length;
  }, [points, showResolved]);

  const handleSelectPoint = useCallback((point: Point) => setSelected(point), []);
  const handleBoundsChange = useCallback((next: BBox) => setBbox(next), []);

  // Cuando un punto cambia (p. ej. moderador lo verifica oficialmente), actualiza
  // tanto el `selected` como el elemento correspondiente en la lista de puntos,
  // para que el badge de la tarjeta y el mapa reflejen el nuevo estado al instante.
  const handlePointUpdated = useCallback((updated: Point) => {
    setSelected(updated);
    setPoints((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  const selectedId = selected?.id;
  const sidePanel = useMemo(() => {
    if (selected) {
      // En móvil el detalle se monta como overlay (HomeBottomSheet) fuera del
      // aside; aquí devolvemos null para no duplicar contenido en el panel.
      if (!isDesktop) return null;
      return <PointDetail point={selected} nearbyPoints={filteredPoints} onClose={() => setSelected(null)} onPointUpdated={handlePointUpdated} />;
    }
    return (
      <>
        <FiltersBar
          type={type}
          helpType={helpType}
          onTypeChange={(t) => {
            setType(t);
            setHelpType("todas");
          }}
          onHelpTypeChange={setHelpType}
          query={query}
          onQueryChange={setQuery}
          showResolved={showResolved}
          onShowResolvedChange={setShowResolved}
          resolvedCount={resolvedHiddenCount}
        />
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Cargando puntos…</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <>
            {truncated && (
              <p className="px-4 pt-3 text-xs text-amber-700 bg-amber-50">
                Hay muchos puntos en esta zona. Mostrando los más recientes — acércate en
                el mapa para ver todos.
              </p>
            )}
            {terms.length > 0 && filteredPoints.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-500">
                No encontramos puntos para “{query}”. Prueba con otra palabra o aleja el mapa.
              </p>
            )}
            <PointList points={filteredPoints} selectedId={selectedId} onSelect={handleSelectPoint} />
          </>
        )}
      </>
    );
  }, [selected, isDesktop, type, helpType, showResolved, resolvedHiddenCount, query, terms, loading, error, truncated, filteredPoints, handleSelectPoint]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)]">
      <div className="relative h-[55vh] md:h-auto md:flex-1">
        <MapView
          points={filteredPoints}
          selectedId={selected?.id}
          onSelectPoint={handleSelectPoint}
          onBoundsChange={handleBoundsChange}
        />
        <Link
          to="/crear"
          className="absolute bottom-4 right-4 z-10 rounded-full bg-brand text-white px-5 py-3 font-semibold shadow-lg hover:bg-brand-dark"
        >
          + Crear
        </Link>
        {/* Botón de pánico (SOS): crea un punto de "necesito ayuda" anónimo en la
            ubicación actual. Posicionado a la izquierda, espejo del botón Crear. */}
        <div className="absolute bottom-4 left-4 z-10">
          <PanicButton
            fallbackLocation={bbox ? { lat: (bbox.minLat + bbox.maxLat) / 2, lng: (bbox.minLng + bbox.maxLng) / 2 } : { lat: 6.2518, lng: -75.5636 }}
            onCreated={() => setRefreshTick((t) => t + 1)}
            onDelete={() => setRefreshTick((t) => t + 1)}
          />
        </div>
      </div>
      <aside className="apc-dark flex-1 md:flex-none md:w-96 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        {sidePanel}
      </aside>

      {/* Overlay móvil: hoja tipo Airbnb sobre el mapa con galería + mini-mapa. */}
      {!isDesktop && selected && (
        <HomeBottomSheet point={selected} nearbyPoints={filteredPoints} onClose={() => setSelected(null)} onPointUpdated={handlePointUpdated} />
      )}
    </div>
  );
}
