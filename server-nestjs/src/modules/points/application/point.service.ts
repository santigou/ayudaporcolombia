import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { generateUniqueCode } from '../../../shared/infrastructure/utils/code.util';

function isPubliclyVisible(p: { type: string; status: string; verificationStatus: string }): boolean {
  // Estados "muertos": nunca se muestran en el listado del mapa, sin importar el
  // tipo. (resolved sigue visible; cancelled/expired/rejected no).
  const deadStatuses = ['cancelled', 'expired', 'rejected'];
  if (deadStatuses.includes(p.status)) return false;
  if (p.type === 'offer_help') return p.verificationStatus === 'approved';
  if (p.type === 'need_help') return p.status === 'active' || p.status === 'resolved';
  return false;
}

// Accesible por CÓDIGO compartible (/p/:code) y verificable por la comunidad.
// Es MÁS PERMISIVO que el listado del mapa: un offer_help PENDIENTE debe poder
// abrirse por su link para que la gente lo verifique —esa validación comunitaria
// es justamente evidencia previa a la aprobación del moderador—. Sí se excluyen
// los rechazados/expirados/cancelados (ya no son válidos).
function isAccessibleByCode(p: { type: string; status: string; verificationStatus: string }): boolean {
  if (p.verificationStatus === 'rejected') return false;
  if (p.status === 'rejected' || p.status === 'expired' || p.status === 'cancelled') return false;
  if (p.type === 'offer_help') return p.verificationStatus === 'pending' || p.verificationStatus === 'approved';
  if (p.type === 'need_help') return p.status === 'active' || p.status === 'resolved';
  return false;
}

// Transiciones de PointStatus (ciclo de vida) permitidas en el cambio de estado
// gestionado por creador/moderador y por las solicitudes de usuarios. La
// verificación (approve/reject/verify) queda fuera de esta máquina: sigue siendo
// exclusiva del moderador y opera sobre verificationStatus, no sobre status.
//
//   active  → resolved   (marcar caso resuelto; sigue visible con badge)
//   active  → cancelled  (cancelar; se oculta del mapa)
//   pending → cancelled  (retirar un offer_help que aún está en revisión)
//   resolved  → active   (reactivar)
//   cancelled → active   (reactivar)
export const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['cancelled']),
  active: new Set(['resolved', 'cancelled']),
  resolved: new Set(['active']),
  cancelled: new Set(['active']),
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

type RichLocation = {
  locationType: string;
  location: { latitude: number; longitude: number; address: string | null; city: string; neighborhood: string };
};

function primaryLocation(locs: RichLocation[]) {
  const chosen = locs.find((l) => l.locationType === 'location') ?? locs[0];
  if (!chosen) return null;
  return { lat: chosen.location.latitude, lng: chosen.location.longitude, address: chosen.location.address, city: chosen.location.city, neighborhood: chosen.location.neighborhood };
}

function allLocations(locs: RichLocation[]) {
  return locs.map((l) => ({ type: l.locationType, lat: l.location.latitude, lng: l.location.longitude, address: l.location.address, city: l.location.city, neighborhood: l.location.neighborhood }));
}

const CONTACT_TYPES = ['phone', 'whatsapp', 'instagram', 'email', 'other'] as const;
type ContactInput = { type: (typeof CONTACT_TYPES)[number]; value: string };
type LocationInput = { type: string; lat: number; lng: number; addressText?: string; city?: string; neighborhood?: string };
type SupplyInput = { name: string; targetQuantity?: number; unit?: string };

@Injectable()
export class PointService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicPoints(opts: { type?: string; minLat?: number; maxLat?: number; minLng?: number; maxLng?: number }) {
    const FETCH_CAP = 600;
    const MAX_RETURN = 300;
    const hasBbox = [opts.minLat, opts.maxLat, opts.minLng, opts.maxLng].every((n) => Number.isFinite(n));
    const points = await this.prisma.point.findMany({
      where: {
        ...(opts.type ? { type: opts.type as any } : {}),
        ...(hasBbox ? { locations: { some: { location: { latitude: { gte: opts.minLat!, lte: opts.maxLat! }, longitude: { gte: opts.minLng!, lte: opts.maxLng! } } } } } : {}),
      },
      orderBy: [{ validationCount: 'desc' }, { createdAt: 'desc' }],
      take: FETCH_CAP,
      include: { locations: { include: { location: true } }, helpType: true, attachments: true },
    });
    const visible = points.filter(isPubliclyVisible).map((p) => ({
      id: p.id, code: p.code, type: p.type, title: p.title, description: p.description,
      status: p.status, verificationStatus: p.verificationStatus, createdAt: p.createdAt,
      validationCount: p.validationCount,
      helpType: p.helpType?.name ?? null, location: primaryLocation(p.locations),
      locations: allLocations(p.locations),
      photos: p.attachments.filter((a) => a.type === 'image').map((a) => a.url),
    }));
    const truncated = visible.length > MAX_RETURN;
    return { points: truncated ? visible.slice(0, MAX_RETURN) : visible, truncated };
  }

  async getById(id: string, currentUserId?: string) {
    const point = await this.prisma.point.findUnique({
      where: { id },
      include: {
        locations: { include: { location: true } }, helpType: true,
        contacts: { where: { isPublic: true } }, supplies: { include: { supply: true } },
        attachments: true, updates: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { id: true, email: true } },
        validations: { where: { status: 'confirmed' }, select: { userId: true } },
      },
    });
    if (!point || !isPubliclyVisible(point)) throw new NotFoundException('Punto no encontrado');
    return {
      id: point.id, code: point.code, type: point.type, title: point.title, description: point.description,
      status: point.status, verificationStatus: point.verificationStatus, createdAt: point.createdAt,
      updatedAt: point.updatedAt, expiresAt: point.expiresAt, helpType: point.helpType?.name ?? null,
      location: primaryLocation(point.locations), locations: allLocations(point.locations),
      contacts: point.contacts.map((c) => ({ type: c.type, value: c.value })),
      supplies: point.supplies.map((s) => ({ name: s.supply.name, targetQuantity: s.targetQuantity !== null ? Number(s.targetQuantity) : null, receivedQuantity: s.receivedQuantity !== null ? Number(s.receivedQuantity) : null, unit: s.unit })),
      photos: point.attachments.filter((a) => a.type === 'image').map((a) => a.url),
      updates: point.updates.map((u) => ({ id: u.id, message: u.message, createdAt: u.createdAt })),
      createdById: point.createdBy?.id ?? null,
      createdByEmail: point.createdBy?.email ?? null,
      validationCount: point.validationCount,
      userValidated: currentUserId ? point.validations.some((v) => v.userId === currentUserId) : false,
    };
  }

  async getByCode(code: string, currentUserId?: string) {
    const point = await this.prisma.point.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        locations: { include: { location: true } }, helpType: true,
        contacts: { where: { isPublic: true } }, attachments: true,
        createdBy: { select: { id: true, email: true } },
        validations: { where: { status: 'confirmed' }, select: { userId: true } },
      },
    });
    if (!point || !isAccessibleByCode(point)) throw new NotFoundException('Punto no encontrado');
    return {
      id: point.id, code: point.code, type: point.type, title: point.title, description: point.description,
      status: point.status, verificationStatus: point.verificationStatus, createdAt: point.createdAt,
      helpType: point.helpType?.name ?? null, location: primaryLocation(point.locations),
      locations: allLocations(point.locations),
      contacts: point.contacts.map((c) => ({ type: c.type, value: c.value })),
      photos: point.attachments.filter((a) => a.type === 'image').map((a) => a.url),
      createdById: point.createdBy?.id ?? null,
      createdByEmail: point.createdBy?.email ?? null,
      validationCount: point.validationCount,
      userValidated: currentUserId ? point.validations.some((v) => v.userId === currentUserId) : false,
    };
  }

  async validate(id: string, userId: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true, type: true, status: true, verificationStatus: true } });
    if (!point || !isAccessibleByCode(point)) throw new NotFoundException('Punto no encontrado');

    // Validación comunitaria atómica estilo "likes": solo incrementa el contador
    // desnormalizado (Point.validationCount) si es una confirmación nueva (antes
    // no existía o estaba rechazada). Si ya estaba confirmada, no hace nada para
    // evitar doble conteo. Todo en transacción para consistencia.
    const existing = await this.prisma.validation.findUnique({
      where: { pointId_userId: { pointId: point.id, userId } },
      select: { status: true },
    });
    if (existing?.status === 'confirmed') {
      const current = await this.prisma.point.findUnique({ where: { id: point.id }, select: { validationCount: true } });
      return { validationCount: current?.validationCount ?? 0, userValidated: true };
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.validation.upsert({
        where: { pointId_userId: { pointId: point.id, userId } },
        update: { status: 'confirmed' },
        create: { pointId: point.id, userId, status: 'confirmed' },
      }),
      this.prisma.point.update({
        where: { id: point.id },
        data: { validationCount: { increment: 1 } },
        select: { validationCount: true },
      }),
    ]);
    return { validationCount: updated.validationCount, userValidated: true };
  }

  async getUpdates(id: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true, type: true, status: true, verificationStatus: true } });
    if (!point || !isAccessibleByCode(point)) throw new NotFoundException('Punto no encontrado');
    const updates = await this.prisma.pointUpdate.findMany({
      where: { pointId: point.id },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { email: true } } },
    });
    return updates.map((u) => ({ id: u.id, message: u.message, createdAt: u.createdAt, createdByEmail: u.createdBy?.email ?? null }));
  }

  // Historial de cambios de estado (ciclo de vida) del punto, del más reciente al
  // más antiguo. Es la fuente del tab "Estado" del detalle. Accesible para cualquiera
  // que pueda ver el punto (mismo criterio que las novedades).
  async getStatusHistory(id: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true, type: true, status: true, verificationStatus: true } });
    if (!point || !isAccessibleByCode(point)) throw new NotFoundException('Punto no encontrado');
    const rows = await this.prisma.pointStatusHistory.findMany({
      where: { pointId: point.id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reason: r.reason,
      actorEmail: r.actor?.email ?? null,
      createdAt: r.createdAt,
    }));
  }

  async createUpdate(id: string, userId: string, message: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true } });
    if (!point) throw new NotFoundException('Punto no encontrado');
    const u = await this.prisma.pointUpdate.create({ data: { pointId: point.id, createdById: userId, message }, include: { createdBy: { select: { email: true } } } });
    return { id: u.id, message: u.message, createdAt: u.createdAt, createdByEmail: u.createdBy?.email ?? null };
  }

  // --- Cambio de estado (ciclo de vida) por creador o moderador ---
  // Aplica una transición de PointStatus validada por la máquina de estados.
  // Autorización: un moderador puede cambiar cualquier punto; el creador solo los
  // suyos (si el punto tiene creador). Un punto anónimo (sin createdById) solo lo
  // puede cambiar un moderador. Registra una fila en PointStatusHistory.
  async changeStatus(id: string, targetStatus: string, actor: { userId: string; role: string }, reason?: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true, status: true, type: true, createdById: true } });
    if (!point) throw new NotFoundException('Punto no encontrado');

    if (!isTransitionAllowed(point.status, targetStatus)) {
      throw new BadRequestException(`No se puede cambiar el estado de "${point.status}" a "${targetStatus}"`);
    }

    const isModerator = actor.role === 'moderator';
    const isOwner = !!point.createdById && point.createdById === actor.userId;
    if (!isModerator && !isOwner) {
      throw new ForbiddenException('Solo el creador del punto o un moderador pueden cambiar su estado');
    }

    // En una transacción: actualiza el estado + deja constancia en el historial.
    const fromStatus = point.status as string;
    await this.prisma.$transaction([
      this.prisma.point.update({ where: { id }, data: { status: targetStatus as any } }),
      this.prisma.pointStatusHistory.create({
        data: {
          pointId: point.id,
          fromStatus: fromStatus as any,
          toStatus: targetStatus as any,
          reason: reason?.trim() || null,
          actorId: actor.userId,
        },
      }),
    ]);
    return { id: point.id, status: targetStatus };
  }

  // --- Solicitud de cambio de estado por un usuario que no es creador/moderador ---
  // El usuario propone un estado objetivo + motivo. Queda pendiente hasta que un
  // moderador la aprueba (entonces se aplica el cambio) o rechaza. Solo se permite
  // UNA solicitud pendiente por (usuario, punto) —garantizado por el índice parcial
  // unique de la migración—. El creador del punto no debería usar esta vía (tiene la
  // directa), pero si lo hace la dejamos pasar por simplicidad.
  async requestStatusChange(id: string, userId: string, targetStatus: string, reason?: string) {
    const point = await this.prisma.point.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!point) throw new NotFoundException('Punto no encontrado');

    if (!isTransitionAllowed(point.status, targetStatus)) {
      throw new BadRequestException(`No se puede solicitar cambiar el estado de "${point.status}" a "${targetStatus}"`);
    }

    try {
      return await this.prisma.pointStatusRequest.create({
        data: { pointId: point.id, userId, targetStatus: targetStatus as any, reason: reason?.trim() || null },
      });
    } catch (err: any) {
      // El índice parcial unique lanzará P2002 si ya existe una pendiente.
      if (err?.code === 'P2002') {
        throw new BadRequestException('Ya tienes una solicitud pendiente para este punto');
      }
      throw err;
    }
  }

  // --- Creación de punto (multipart con fotos) ---
  async create(data: {
    type: 'need_help' | 'offer_help'; title: string; description: string; helpTypeName?: string;
    contacts?: ContactInput[]; locations?: LocationInput[]; supplies?: SupplyInput[];
    lat?: number; lng?: number; addressText?: string; city?: string; neighborhood?: string;
    expiresAt?: Date; photoUrls: string[];
  }, userId?: string) {
    if (!data.helpTypeName) throw new BadRequestException('Indica el tipo de ayuda');
    if (data.type === 'offer_help' && !userId) throw new BadRequestException('Los puntos de ayuda requieren iniciar sesión');
    const contacts = this.buildContacts(data.contacts);
    if (contacts.length === 0) throw new BadRequestException('Indica al menos un contacto válido');
    const locations = this.buildLocations(data);
    if (locations.length === 0) throw new BadRequestException('Marca al menos una ubicación en el mapa');
    const supplies = this.buildSupplies(data.supplies);

    const helpType = await this.prisma.helpType.upsert({ where: { name: data.helpTypeName }, update: {}, create: { name: data.helpTypeName, description: data.helpTypeName } });
    const supplyRows = await Promise.all(supplies.map(async (s) => {
      const supply = await this.prisma.supply.upsert({ where: { name: s.name }, update: {}, create: { name: s.name } });
      return { supplyId: supply.id, targetQuantity: s.targetQuantity ?? null, unit: s.unit ?? null };
    }));

    const isOffer = data.type === 'offer_help';
    return this.prisma.point.create({
      data: {
        code: await generateUniqueCode(this.prisma),
        type: data.type, title: data.title, description: data.description, helpTypeId: helpType.id,
        status: isOffer ? 'pending' : 'active', verificationStatus: 'pending',
        createdById: userId ?? null, expiresAt: data.expiresAt ?? null,
        locations: { create: locations.map((l) => ({ locationType: l.type as any, location: { create: { city: l.city ?? '', neighborhood: l.neighborhood ?? '', address: l.addressText ?? null, latitude: l.lat, longitude: l.lng } } })) as any },
        contacts: { create: contacts.map((c) => ({ type: c.type, value: c.value, isPublic: true })) },
        ...(supplyRows.length ? { supplies: { create: supplyRows } } : {}),
        ...(data.photoUrls.length ? { attachments: { create: data.photoUrls.map((url) => ({ url, type: 'image' as const })) } } : {}),
      },
    });
  }

  private buildContacts(raw?: ContactInput[]): ContactInput[] {
    if (!raw) return [];
    return raw.filter((c) => CONTACT_TYPES.includes(c.type) && c.value?.trim()).map((c) => ({ type: c.type, value: c.value.trim() }));
  }

  private buildLocations(data: { locations?: LocationInput[]; lat?: number; lng?: number; addressText?: string; city?: string; neighborhood?: string }): LocationInput[] {
    if (data.locations && data.locations.length > 0) {
      return data.locations.filter((l) => l.lat != null && l.lng != null && ['location', 'origin', 'destination'].includes(l.type)).map((l) => ({ type: l.type, lat: l.lat, lng: l.lng, addressText: l.addressText ?? '', city: l.city ?? '', neighborhood: l.neighborhood ?? '' }));
    }
    if (data.lat != null && data.lng != null) {
      return [{ type: 'location', lat: data.lat, lng: data.lng, addressText: data.addressText ?? '', city: data.city ?? '', neighborhood: data.neighborhood ?? '' }];
    }
    return [];
  }

  private buildSupplies(raw?: SupplyInput[]): SupplyInput[] {
    if (!raw) return [];
    return raw.filter((s) => s.name && s.name.trim().length >= 2);
  }
}
