import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { attachUserIfPresent, requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

export const pointsRouter = Router();

type PointVisibility = {
  type: string;
  status: string;
  verificationStatus: string;
};

type RichLocation = {
  locationType: string;
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
    city: string;
    neighborhood: string;
  };
};

// offer_help (recurso/oferta): visible cuando un moderador lo verificó (verificationStatus = approved).
// need_help  (persona no ubicada): visible al publicarse (status active/resolved), sin verificación previa.
function isPubliclyVisible(p: PointVisibility): boolean {
  if (p.type === "offer_help") return p.verificationStatus === "approved";
  if (p.type === "need_help") return p.status === "active" || p.status === "resolved";
  return false;
}

function primaryLocation(locs: RichLocation[]) {
  const chosen = locs.find((l) => l.locationType === "location") ?? locs[0];
  if (!chosen) return null;
  return {
    lat: chosen.location.latitude,
    lng: chosen.location.longitude,
    address: chosen.location.address,
    city: chosen.location.city,
    neighborhood: chosen.location.neighborhood,
  };
}

// Todas las ubicaciones del punto, con su rol (location/origin/destination).
// Se expone en el detalle (GET /:id) para que la UI muestre varias ubicaciones.
function allLocations(locs: RichLocation[]) {
  return locs.map((l) => ({
    type: l.locationType,
    lat: l.location.latitude,
    lng: l.location.longitude,
    address: l.location.address,
    city: l.location.city,
    neighborhood: l.location.neighborhood,
  }));
}

pointsRouter.get("/", async (req, res) => {
  const rawType = typeof req.query.type === "string" ? req.query.type : undefined;
  const type = rawType === "need_help" || rawType === "offer_help" ? rawType : undefined;

  // Bounding box opcional (lo visible del mapa) para cargar solo esa zona.
  const q = req.query;
  const minLat = Number(q.minLat);
  const maxLat = Number(q.maxLat);
  const minLng = Number(q.minLng);
  const maxLng = Number(q.maxLng);
  const hasBbox = [minLat, maxLat, minLng, maxLng].every((n) => Number.isFinite(n));

  // Cap para no saturar: traemos un margen y devolvemos como mucho MAX_RETURN.
  // Si quedan más visibles, marcamos `truncated` para que la UI pida acercarse.
  const FETCH_CAP = 600;
  const MAX_RETURN = 300;

  const points = await prisma.point.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(hasBbox
        ? {
            locations: {
              some: {
                location: {
                  latitude: { gte: minLat, lte: maxLat },
                  longitude: { gte: minLng, lte: maxLng },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: FETCH_CAP,
    include: {
      locations: { include: { location: true } },
      helpType: true,
      attachments: true,
    },
  });

  const visible = points.filter(isPubliclyVisible).map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    description: p.description,
    status: p.status,
    verificationStatus: p.verificationStatus,
    createdAt: p.createdAt,
    helpType: p.helpType?.name ?? null,
    location: primaryLocation(p.locations),
    locations: allLocations(p.locations),
    photos: p.attachments.filter((a) => a.type === "image").map((a) => a.url),
  }));

  const truncated = visible.length > MAX_RETURN;
  res.json({ points: truncated ? visible.slice(0, MAX_RETURN) : visible, truncated });
});

pointsRouter.get("/:id", async (req, res) => {
  const point = await prisma.point.findUnique({
    where: { id: req.params.id },
    include: {
      locations: { include: { location: true } },
      helpType: true,
      contacts: { where: { isPublic: true } },
      supplies: { include: { supply: true } },
      attachments: true,
      updates: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { email: true } },
    },
  });
  if (!point || !isPubliclyVisible(point)) {
    return res.status(404).json({ error: "Punto no encontrado" });
  }

  res.json({
    id: point.id,
    type: point.type,
    title: point.title,
    description: point.description,
    status: point.status,
    verificationStatus: point.verificationStatus,
    createdAt: point.createdAt,
    updatedAt: point.updatedAt,
    expiresAt: point.expiresAt,
    helpType: point.helpType?.name ?? null,
    location: primaryLocation(point.locations),
    locations: allLocations(point.locations),
    contacts: point.contacts.map((c) => ({ type: c.type, value: c.value })),
    supplies: point.supplies.map((s) => ({
      name: s.supply.name,
      targetQuantity: s.targetQuantity !== null ? Number(s.targetQuantity) : null,
      receivedQuantity: s.receivedQuantity !== null ? Number(s.receivedQuantity) : null,
      unit: s.unit,
    })),
    photos: point.attachments.filter((a) => a.type === "image").map((a) => a.url),
    updates: point.updates.map((u) => ({ id: u.id, message: u.message, createdAt: u.createdAt })),
    createdByEmail: point.createdBy?.email ?? null,
  });
});


// --- Timeline de novedades (PointUpdate) ---

pointsRouter.get("/:id/updates", async (req, res) => {
  const point = await prisma.point.findUnique({
    where: { id: req.params.id },
    select: { id: true, type: true, status: true, verificationStatus: true },
  });
  if (!point || !isPubliclyVisible(point)) {
    return res.status(404).json({ error: "Punto no encontrado" });
  }
  const updates = await prisma.pointUpdate.findMany({
    where: { pointId: point.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, createdAt: true },
  });
  res.json(updates);
});

const updateSchema = z.object({
  message: z.string().min(1).max(500),
});

pointsRouter.post("/:id/updates", requireAuth, async (req, res) => {
  const point = await prisma.point.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!point) {
    return res.status(404).json({ error: "Punto no encontrado" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const update = await prisma.pointUpdate.create({
    data: { pointId: point.id, createdById: req.user!.userId, message: parsed.data.message },
    select: { id: true, message: true, createdAt: true },
  });
  res.status(201).json(update);
});

// La creación mantiene un shape cercano al anterior (multipart con fotos) pero
// adaptado al modelo rico: las coordenadas van a `Location`+`PointLocation`, el
// contacto de texto a la tabla `Contact`, las fotos a `Attachment`, y la
// categoría pasa a ser un `HelpType` (catálogo) referenciado por nombre.
const createSchema = z.object({
  type: z.enum(["need_help", "offer_help"]),
  title: z.string().min(3).max(150),
  description: z.string().min(10).max(2000),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  addressText: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  locations: z.string().optional(), // JSON: [{type,lat,lng,addressText?,city?,neighborhood?}] → multi-ubicación
  helpTypeName: z.string().min(2).max(80).optional(),
  contactInfo: z.string().min(3).max(200).optional(),
  contacts: z.string().optional(), // JSON: [{type,value}] → tabla Contact tipada
  supplies: z.string().optional(), // JSON: [{name,targetQuantity?,unit?}] → tabla PointSupply (M:N con Supply)
  expiresAt: z.coerce.date().optional(),
});

// Tipos de contacto válidos según el catálogo ContactType del modelo de datos.
const CONTACT_TYPES = ["phone", "whatsapp", "instagram", "email", "other"] as const;
type ContactInput = { type: (typeof CONTACT_TYPES)[number]; value: string };

// Suministro de entrada: nombre (catálogo Supply por upsert) + cantidad esperada
// y unidad opcionales (tabla PointSupply, relación M:N con Point).
type SupplyInput = { name: string; targetQuantity?: number; unit?: string };

// Construye la lista de contactos desde el JSON `contacts` (preferido) o desde
// el campo legacy `contactInfo`. Devuelve [] si no hay ninguno válido.
function buildContacts(rawContacts: unknown, legacy: string | undefined): ContactInput[] {
  const parsed: { type?: string; value?: string }[] = [];
  if (typeof rawContacts === "string" && rawContacts.trim()) {
    try {
      const arr = JSON.parse(rawContacts);
      if (Array.isArray(arr)) parsed.push(...arr);
    } catch {
      // JSON malformado: se ignora y cae al fallback legacy.
    }
  }
  const fromParsed = parsed
    .map((c) => ({
      type: (CONTACT_TYPES as readonly string[]).includes(c.type ?? "")
        ? (c.type as ContactInput["type"])
        : "other",
      value: (c.value ?? "").trim(),
    }))
    .filter((c) => c.value.length >= 3 && c.value.length <= 200);
  if (fromParsed.length > 0) return fromParsed;
  if (legacy && legacy.trim()) return [{ type: "other", value: legacy.trim() }];
  return [];
}

// Roles de ubicación válidos según el catálogo PointLocationType del modelo.
const LOCATION_TYPES = ["location", "origin", "destination"] as const;
type LocationInput = {
  type: (typeof LOCATION_TYPES)[number];
  lat: number;
  lng: number;
  addressText: string | null;
  city: string;
  neighborhood: string;
};

// Construye la lista de ubicaciones desde el JSON `locations` (preferido) o desde
// los campos legacy sueltos `lat`/`lng`/... (una única ubicación principal).
// Devuelve [] si no hay ninguna coordenada válida.
function buildLocations(data: {
  locations?: string;
  lat?: number;
  lng?: number;
  addressText?: string;
  city?: string;
  neighborhood?: string;
}): LocationInput[] {
  const parsed: {
    type?: string;
    lat?: number;
    lng?: number;
    addressText?: string;
    city?: string;
    neighborhood?: string;
  }[] = [];
  if (typeof data.locations === "string" && data.locations.trim()) {
    try {
      const arr = JSON.parse(data.locations);
      if (Array.isArray(arr)) parsed.push(...arr);
    } catch {
      // JSON malformado: se ignora y cae al fallback legacy.
    }
  }
  const fromParsed = parsed
    .map((l) => ({
      type: (LOCATION_TYPES as readonly string[]).includes(l.type ?? "")
        ? (l.type as LocationInput["type"])
        : "location",
      lat: Number(l.lat),
      lng: Number(l.lng),
      addressText: (l.addressText ?? "").trim() || null,
      city: (l.city ?? "").trim(),
      neighborhood: (l.neighborhood ?? "").trim(),
    }))
    .filter(
      (l) =>
        Number.isFinite(l.lat) &&
        l.lat >= -90 &&
        l.lat <= 90 &&
        Number.isFinite(l.lng) &&
        l.lng >= -180 &&
        l.lng <= 180,
    );
  if (fromParsed.length > 0) return fromParsed;
  if (data.lat !== undefined && data.lng !== undefined) {
    return [
      {
        type: "location",
        lat: data.lat,
        lng: data.lng,
        addressText: data.addressText?.trim() || null,
        city: data.city?.trim() ?? "",
        neighborhood: data.neighborhood?.trim() ?? "",
      },
    ];
  }
  return [];
}

// Construye la lista de suministros desde el JSON `supplies`. Cada uno tiene un
// nombre (se hace upsert en el catálogo Supply) y, opcionalmente, una cantidad
// "esperada" (targetQuantity) y una unidad. Devuelve [] si no hay ninguno válido.
function buildSupplies(rawSupplies: unknown): SupplyInput[] {
  const parsed: { name?: string; targetQuantity?: number | string; unit?: string }[] = [];
  if (typeof rawSupplies === "string" && rawSupplies.trim()) {
    try {
      const arr = JSON.parse(rawSupplies);
      if (Array.isArray(arr)) parsed.push(...arr);
    } catch {
      // JSON malformado: se ignora.
    }
  }
  const seen = new Set<string>();
  const out: SupplyInput[] = [];
  for (const s of parsed) {
    const name = (s.name ?? "").trim();
    if (name.length < 2 || name.length > 80) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // evita duplicados (PK compuesta pointId+supplyId)
    seen.add(key);
    const qtyNum = typeof s.targetQuantity === "string" ? Number(s.targetQuantity) : s.targetQuantity;
    out.push({
      name,
      targetQuantity: Number.isFinite(qtyNum) && qtyNum! > 0 ? qtyNum! : undefined,
      unit: typeof s.unit === "string" ? s.unit.trim().slice(0, 24) || undefined : undefined,
    });
  }
  return out;
}

pointsRouter.post("/", attachUserIfPresent, upload.array("photos", 5), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const data = parsed.data;

  // El tipo de ayuda (Refugio/Alimentos/Agua/Médico/Otro) es obligatorio para
  // AMBOS tipos de punto (offer_help y need_help). Antes solo se exigía a offer_help.
  if (!data.helpTypeName) {
    return res.status(400).json({ error: "Indica el tipo de ayuda" });
  }
  // offer_help necesita moderación/trazabilidad → solo usuarios autenticados.
  // need_help puede crearse de forma anónimo (la urgencia pesa más que el autor).
  if (data.type === "offer_help" && !req.user) {
    return res.status(401).json({ error: "Los puntos de ayuda requieren iniciar sesión" });
  }

  const contacts = buildContacts(data.contacts, data.contactInfo);
  if (contacts.length === 0) {
    return res.status(400).json({ error: "Indica al menos un contacto válido" });
  }

  const locations = buildLocations(data);
  if (locations.length === 0) {
    return res.status(400).json({ error: "Marca al menos una ubicación en el mapa" });
  }

  const supplies = buildSupplies(data.supplies);

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const photos = files.map((f) => `/uploads/${f.filename}`);

  // Resolver (o crear) el HelpType por nombre, si vino.
  let helpTypeId: string | undefined;
  if (data.helpTypeName) {
    const helpType = await prisma.helpType.upsert({
      where: { name: data.helpTypeName },
      update: {},
      create: { name: data.helpTypeName, description: data.helpTypeName },
    });
    helpTypeId = helpType.id;
  }

  // Resolver (o crear) cada Supply por nombre y mapearlo a su PointSupply con
  // la cantidad esperada y unidad opcionales.
  const supplyRows = await Promise.all(
    supplies.map(async (s) => {
      const supply = await prisma.supply.upsert({
        where: { name: s.name },
        update: {},
        create: { name: s.name },
      });
      return {
        supplyId: supply.id,
        targetQuantity: s.targetQuantity ?? null,
        unit: s.unit ?? null,
      };
    }),
  );

  const isOffer = data.type === "offer_help";

  const point = await prisma.point.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      helpTypeId,
      status: isOffer ? "pending" : "active",
      verificationStatus: "pending",
      createdById: req.user?.userId ?? null,
      expiresAt: data.expiresAt ?? null,
      locations: {
        create: locations.map((l) => ({
          locationType: l.type,
          location: {
            create: {
              city: l.city,
              neighborhood: l.neighborhood,
              address: l.addressText,
              latitude: l.lat,
              longitude: l.lng,
            },
          },
        })),
      },
      contacts: {
        create: contacts.map((c) => ({ type: c.type, value: c.value, isPublic: true })),
      },
      ...(supplyRows.length
        ? { supplies: { create: supplyRows } }
        : {}),
      ...(photos.length
        ? { attachments: { create: photos.map((url) => ({ url, type: "image" as const })) } }
        : {}),
    },
    include: {
      locations: { include: { location: true } },
      helpType: true,
      contacts: true,
      supplies: { include: { supply: true } },
      attachments: true,
    },
  });

  res.status(201).json(point);
});
