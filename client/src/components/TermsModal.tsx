interface TermsModalProps {
  open: boolean;
  onClose: () => void;
}

const CONTACT_EMAIL = "j4fdevelopment@gmail.com";

// Explica en lenguaje simple qué datos guarda la app, para qué, quién los ve y
// cómo pedir que se corrijan/eliminen (Ley 1581 de 2012). Refleja el
// comportamiento REAL de la app (no es un texto legal genérico): los puntos y
// sus contactos son públicos por diseño (para poder coordinar), y no usamos
// cookies de rastreo ni analítica de ningún tipo.
export function TermsModal({ open, onClose }: TermsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tus datos y esta app</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Qué guardamos</h3>
            <p className="mt-1">
              Lo que registras en cada punto: título, descripción, tipo de ayuda, ubicación, insumos, fotos y los
              contactos que escribas (teléfono, WhatsApp, Instagram o correo). Si creas una cuenta: tu correo y tu
              contraseña (guardada cifrada, nunca en texto plano). También las novedades/mensajes que publiques en un
              punto.
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Para qué</h3>
            <p className="mt-1">
              Solo para coordinar la ayuda tras el sismo: saber qué falta, qué hay disponible y cómo contactar a
              quien puede ayudar. No vendemos ni compartimos tus datos con nadie.
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Quién los ve</h3>
            <p className="mt-1">
              Los puntos son públicos — ubicación, descripción, insumos, fotos y los contactos que agregues ahí los
              ve cualquiera que entre al mapa: esa es la razón de ser de la app, para que te puedan contactar y
              coordinar. Si publicas una novedad en un punto, tu correo queda visible junto a ella. Tu correo de
              cuenta nunca se muestra en un punto público; solo lo ven los moderadores al revisar puntos pendientes o
              solicitudes de moderador.
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cookies</h3>
            <p className="mt-1">
              Por ahora no usamos cookies de rastreo ni analítica de ningún tipo (nada de Google Analytics ni
              similares). La única cookie que usamos es técnica: mantener tu sesión iniciada.
            </p>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tus derechos</h3>
            <p className="mt-1">
              Puedes pedir que corrijamos o eliminemos tus datos escribiendo a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-dark underline dark:text-brand">
                {CONTACT_EMAIL}
              </a>
              . Ley 1581 de 2012 de protección de datos personales.
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
