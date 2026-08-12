import { useEffect, useMemo } from "react";

interface PhotoInputProps {
  photos: File[];
  onChange: (files: File[]) => void;
  max?: number;
}

// Selector de fotos con miniaturas y borrado individual. Acota a `max` (3 por
// defecto) aunque el backend admita más.
export function PhotoInput({ photos, onChange, max = 3 }: PhotoInputProps) {
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);

  // Revoca los object URLs cuando cambian o al desmontar.
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const remaining = max - photos.length;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next = [...photos, ...Array.from(files).filter((f) => f.type.startsWith("image/"))].slice(
      0,
      max,
    );
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div
            key={i}
            className="relative h-16 w-16 overflow-hidden rounded-md border border-gray-200"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              aria-label="Quitar foto"
              className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-xl text-gray-400 hover:border-brand hover:text-brand">
            +
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Máximo {max} fotos · {photos.length}/{max} añadidas
      </p>
    </div>
  );
}
