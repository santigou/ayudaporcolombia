// Burbuja de mensaje del chat con IA. Casos:
// - Texto normal (usuario o asistente), con cursor ▍ mientras hace streaming.
// - `fallbackText`: el asistente respondió solo con tool calls (sin frase
//   visible) → se muestra un texto derivado de la acción + Reintentar.
// - Sin nada aprovechable → nota con Reintentar.

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  // Texto derivado cuando no hubo frase visible (y por tanto `text` vacío).
  fallbackText?: string | null;
  onRetry?: () => void;
}

export function MessageBubble({ role, text, streaming, fallbackText, onRetry }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        }`}
      >
        {text ? (
          <p className="whitespace-pre-wrap break-words">
            {text}
            {streaming && <span className="animate-blink">▍</span>}
          </p>
        ) : fallbackText ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="whitespace-pre-wrap break-words">{fallbackText}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Reintentar
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="italic text-gray-400">(el asistente no respondió nada útil)</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
