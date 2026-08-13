import { useRef, useState } from "react";

interface ImageGalleryProps {
  photos: string[];
  alt: string;
  className?: string;
}

// Galería reutilizable de fotos de un punto:
// - Foto principal + flechas ‹ › + contador "2 / 5" + tira de miniaturas.
// - En móvil además soporta swipe horizontal (touch) con puntos indicadores.
// Si no hay fotos, no renderiza nada.
export function ImageGallery({ photos, alt, className = "" }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  // Coordenadas iniciales del toque para detectar swipe horizontal dominante.
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  if (photos.length === 0) return null;

  const total = photos.length;
  const go = (next: number) => setIndex(((next % total) + total) % total);
  const prev = () => go(index - 1);
  const next = () => go(index + 1);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const startX = startXRef.current;
    const startY = startYRef.current;
    startXRef.current = null;
    startYRef.current = null;
    if (startX == null || startY == null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    // Solo cuenta como swipe si el desplazamiento horizontal domina al vertical
    // (para no robar el scroll vertical de la hoja).
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  }

  return (
    <div className={className}>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={photos[index]}
          alt={`${alt} — foto ${index + 1}`}
          className="h-full w-full select-none object-cover"
          draggable={false}
        />
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-gray-700 shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-gray-700 shadow hover:bg-white"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <>
          {/* Puntos (móvil) */}
          <div className="mt-2 flex justify-center gap-1.5 md:hidden">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a la foto ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-brand" : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>
          {/* Miniaturas (desktop) */}
          <div className="mt-2 hidden gap-2 overflow-x-auto md:flex">
            {photos.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition ${
                  i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
