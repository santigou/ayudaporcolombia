import type { ContactInfo, Point, PointUpdateItem, PointType } from "../../types";

// Centro por defecto (igual que MapView): Medellín. Se usa si el navegador no
// da/permite GPS, y como centro inicial de los puntos mock antes de que el mapa
// reporte su zona visible real.
export const MEDELLIN = { lat: 6.2518, lng: -75.5636 };

// Generador de ids estable para las novedades simuladas (sin backend).
export function uid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Miniatura SVG embebida como data-URI: así el tutorial NO hace peticiones de
// red para mostrar fotos (todo es local/offline). Le ponemos el título del punto.
function svg(bg: string, fg: string, label: string): string {
  const svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='52%' fill='${fg}' font-family='system-ui,sans-serif' font-size='22' font-weight='700' text-anchor='middle'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
}

// Offsets fijos (dlat, dlng) repartidos en ±0.022° (≈ ±2.4 km) alrededor del
// centro que elija el mapa (zona del usuario o Medellín). Al ser fijos, los 10
// puntos guardan siempre la misma disposición relativa entre sí.
const OFFSETS: Array<[number, number]> = [
  [-0.006, -0.004],
  [-0.01, 0.008],
  [0.006, -0.012],
  [0.012, 0.006],
  [-0.014, -0.014],
  [0.0, 0.014],
  [-0.004, 0.02],
  [0.018, -0.006],
  [-0.02, 0.002],
  [0.022, 0.016],
];

interface Spec {
  type: PointType;
  title: string;
  description: string;
  helpType: string;
  verificationStatus: "pending" | "approved" | "rejected";
  supplies: { name: string; targetQuantity: number | null; receivedQuantity: number | null; unit: string | null }[];
  contacts: ContactInfo[];
}

// 10 puntos de ejemplo (5 need_help + 5 offer_help) con catálogo de ayudas
// variado (Refugio, Alimentos, Agua, Médico, Otro) para que se vean distintos
// badges y secciones rellenadas en el detalle.
const SPECS: Spec[] = [
  {
    type: "need_help",
    title: "Refugio temporal — Casa Comunitaria",
    description:
      "Varias familias afectadas necesitan un lugar seguro para pernoctar. Tenemos espacio para 30 personas pero nos hace falta apoyo con colchones, agua y alimentos.",
    helpType: "Refugio",
    verificationStatus: "pending",
    supplies: [
      { name: "Colchones / Mantas", targetQuantity: 30, receivedQuantity: 8, unit: "Unidades" },
      { name: "Agua", targetQuantity: 100, receivedQuantity: 25, unit: "Litros" },
      { name: "Alimentos no perecederos", targetQuantity: 40, receivedQuantity: 12, unit: "Cajas" },
    ],
    contacts: [
      { type: "phone", value: "+57 300 000 0000" },
      { type: "whatsapp", value: "+57 300 000 0000" },
    ],
  },
  {
    type: "need_help",
    title: "Necesitamos agua potable",
    description: "El acueducto del barrio se dañó y necesitamos agua para 15 familias con niños.",
    helpType: "Agua",
    verificationStatus: "approved",
    supplies: [{ name: "Agua", targetQuantity: 200, receivedQuantity: 60, unit: "Litros" }],
    contacts: [{ type: "whatsapp", value: "+57 301 111 1111" }],
  },
  {
    type: "need_help",
    title: "Solicitud de alimentos",
    description: "Buscamos alimentos no perecederos para entregar en un comedor comunitario.",
    helpType: "Alimentos",
    verificationStatus: "pending",
    supplies: [{ name: "Alimentos no perecederos", targetQuantity: 60, receivedQuantity: 20, unit: "Cajas" }],
    contacts: [{ type: "phone", value: "+57 302 222 2222" }],
  },
  {
    type: "need_help",
    title: "Se requiere atención médica",
    description: "Persona mayor con hipertensión necesita control y medicamentos.",
    helpType: "Médico",
    verificationStatus: "pending",
    supplies: [{ name: "Medicamentos", targetQuantity: null, receivedQuantity: null, unit: null }],
    contacts: [{ type: "phone", value: "+57 303 333 3333" }],
  },
  {
    type: "need_help",
    title: "Alimento para mascotas",
    description: "Buscamos alimento para perros y gatos de familias damnificadas.",
    helpType: "Otro",
    verificationStatus: "pending",
    supplies: [],
    contacts: [{ type: "instagram", value: "@ayudamascotas" }],
  },
  {
    type: "offer_help",
    title: "Entrega de almuerzos calientes",
    description: "Cocina comunitaria entrega almuerzos gratis de 12 m a 2 pm. Capacidad para 100 personas.",
    helpType: "Alimentos",
    verificationStatus: "approved",
    supplies: [{ name: "Alimentos preparados", targetQuantity: 100, receivedQuantity: 0, unit: "Raciones" }],
    contacts: [{ type: "whatsapp", value: "+57 304 444 4444" }],
  },
  {
    type: "offer_help",
    title: "Cupos disponibles en refugio",
    description: "Tenemos cupo para 20 personas. Llevar documento de identidad.",
    helpType: "Refugio",
    verificationStatus: "pending",
    supplies: [],
    contacts: [{ type: "phone", value: "+57 305 555 5555" }],
  },
  {
    type: "offer_help",
    title: "Distribución de agua gratis",
    description: "Carrotanque repartiendo agua potable. Punto de entrega en el parque.",
    helpType: "Agua",
    verificationStatus: "approved",
    supplies: [{ name: "Agua", targetQuantity: 2000, receivedQuantity: 0, unit: "Litros" }],
    contacts: [{ type: "whatsapp", value: "+57 306 666 6666" }],
  },
  {
    type: "offer_help",
    title: "Brigada médica voluntaria",
    description: "Médicos voluntarios atendiendo consultas generales y primeros auxilios.",
    helpType: "Médico",
    verificationStatus: "pending",
    supplies: [{ name: "Voluntarios", targetQuantity: 5, receivedQuantity: 0, unit: "Personas" }],
    contacts: [{ type: "phone", value: "+57 307 777 7777" }],
  },
  {
    type: "offer_help",
    title: "Transporte voluntario",
    description: "Vehículo disponible para traslado de personas y donaciones dentro de la zona.",
    helpType: "Otro",
    verificationStatus: "pending",
    supplies: [],
    contacts: [{ type: "phone", value: "+57 308 888 8888" }],
  },
];

// Construye los 10 puntos mock alrededor del `center` indicado (zona del usuario
// o Medellín). Devuelve objetos con la misma forma que el Point real, así el
// detalle y el mapa los consumen sin distinguirlos de los de producción.
export function buildMockPoints(center: { lat: number; lng: number }): Point[] {
  return SPECS.map((s, i) => {
    const [dlat, dlng] = OFFSETS[i];
    const isNeed = s.type === "need_help";
    const label = s.title.length > 16 ? `${s.title.slice(0, 15)}…` : s.title;
    return {
      id: `mock-${i}`,
      code: `AYU-${1000 + i}`,
      type: s.type,
      title: s.title,
      description: s.description,
      status: "active" as const,
      verificationStatus: s.verificationStatus,
      createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
      helpType: s.helpType,
      location: {
        lat: center.lat + dlat,
        lng: center.lng + dlng,
        address: `Calle ${10 + i} # ${i + 1}-${20 + i}`,
        city: "Tu zona",
        neighborhood: `Sector ${i + 1}`,
      },
      photos: [
        svg(isNeed ? "#fee2e2" : "#dcfce7", isNeed ? "#b91c1c" : "#15803d", label),
        svg(isNeed ? "#fef3c7" : "#cffafe", isNeed ? "#92400e" : "#0e7490", `Foto ${i + 1}`),
      ],
      contacts: s.contacts,
      supplies: s.supplies,
      validationCount: (i * 3) % 7,
      userValidated: false,
    };
  });
}

// Novedades pre-existentes del punto tutorial, para que la pestaña Novedades no
// aparezca vacía y el usuario vea cómo se ve el timeline (estilo chat).
export const INITIAL_TUTORIAL_UPDATES: PointUpdateItem[] = [
  {
    id: "mock-update-1",
    message: "Llegaron 20 raciones de almuerzo. ¡Gracias a todos los que ayudaron!",
    kind: "done",
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    createdByEmail: "coordina@demo",
  },
  {
    id: "mock-update-2",
    message: "Necesitamos agua potable con urgencia para las familias.",
    kind: "urgent",
    createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
    createdByEmail: "coordina@demo",
  },
  {
    id: "mock-update-3",
    message: "Voy en camino con medicamentos, llego en 30 minutos.",
    kind: "helping",
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    createdByEmail: "voluntaria@demo",
  },
];