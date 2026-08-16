// Respuestas rápidas cuando el resumen está en pantalla: aprobar publica
// DIRECTO (sin esperar al modelo — determinista) o corregir algo.

interface QuickRepliesProps {
  onApprove: () => void;
  onCorrect: () => void;
  disabled?: boolean;
}

export function QuickReplies({ onApprove, onCorrect, disabled }: QuickRepliesProps) {
  return (
    <div className="flex shrink-0 gap-2 px-4 pt-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        ✓ Sí, publícalo
      </button>
      <button
        type="button"
        onClick={onCorrect}
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        ✏️ Corregir algo
      </button>
    </div>
  );
}
