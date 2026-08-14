import type { ReactNode } from "react";

interface BottomSheetProps {
  // En móvil: true = hoja alta (formularios); false = "peek" (mapa visible y tocable).
  // En escritorio se ignora: siempre es panel lateral derecho a altura completa.
  expanded: boolean;
  children: ReactNode;
}

// Contenedor responsive del asistente de creación:
// - Móvil: hoja inferior fija (bottom-sheet) con handle y altura animada.
// - Escritorio (md+): panel lateral derecho fijo, como el del Home.
// El mapa (a pantalla completa) vive detrás/almohado y NUNCA se reduce de tamaño.
export function BottomSheet({ expanded, children }: BottomSheetProps) {
  return (
    <div
      className={[
        "apc-dark fixed inset-x-0 bottom-0 z-20 flex flex-col bg-white",
        "border-t border-gray-200 shadow-2xl rounded-t-2xl",
        "dark:bg-gray-900 dark:border-gray-700",
        "transition-[max-height] duration-300 ease-out",
        "md:static md:inset-auto md:bottom-auto md:h-full md:w-96 md:max-w-[26rem]",
        "md:rounded-none md:shadow-none md:border-t-0 md:border-l",
        expanded ? "max-h-[88vh]" : "max-h-[44vh]",
        "md:max-h-none",
      ].join(" ")}
    >
      {/* Handle de arrastre (solo móvil) */}
      <div className="flex justify-center pt-2 md:hidden">
        <div className="h-1.5 w-10 rounded-full bg-gray-300" />
      </div>
      {children}
    </div>
  );
}
