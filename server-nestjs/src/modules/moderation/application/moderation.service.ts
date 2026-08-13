import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';

function primaryLocation(locs: any[]) {
  const chosen = locs.find((l) => l.locationType === 'location') ?? locs[0];
  if (!chosen) return null;
  return { lat: chosen.location.latitude, lng: chosen.location.longitude, address: chosen.location.address, city: chosen.location.city, neighborhood: chosen.location.neighborhood };
}

// Servicio de moderación: cola de puntos pendientes, aprobar/rechazar puntos y
// solicitudes de moderador. Replica moderator.routes.ts del Express.
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  // Cola de offer_help pendientes de verificación, con datos para moderación.
  async getPendingPoints() {
    const points = await this.prisma.point.findMany({
      where: { type: 'offer_help', verificationStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        createdBy: { select: { id: true, email: true } },
        locations: { include: { location: true } },
        helpType: true,
        contacts: true,
        attachments: true,
      },
    });
    return points.map((p) => {
      const loc = (p.locations.find((l) => l.locationType === 'location') ?? p.locations[0])?.location;
      return {
        id: p.id, code: p.code, type: p.type, title: p.title, description: p.description,
        status: p.status, verificationStatus: p.verificationStatus, createdAt: p.createdAt,
        helpType: p.helpType?.name ?? null,
        location: loc ? { lat: loc.latitude, lng: loc.longitude, address: loc.address, city: loc.city, neighborhood: loc.neighborhood } : null,
        locations: p.locations.map((l) => ({ type: l.locationType, lat: l.location.latitude, lng: l.location.longitude, address: l.location.address, city: l.location.city, neighborhood: l.location.neighborhood })),
        photos: p.attachments.filter((a) => a.type === 'image').map((a) => a.url),
        contacts: p.contacts.map((c) => ({ type: c.type, value: c.value })),
        createdBy: p.createdBy,
        validationCount: p.validationCount,
      };
    });
  }

  async approvePoint(id: string, moderatorId: string) {
    const point = await this.prisma.point.findUnique({ where: { id } });
    if (!point || point.type !== 'offer_help' || point.verificationStatus !== 'pending') {
      throw new NotFoundException('Punto no encontrado o no pendiente');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.verification.create({ data: { pointId: id, moderatorId, status: 'approved' } }),
      this.prisma.point.update({ where: { id }, data: { verificationStatus: 'approved', status: 'active' } }),
    ]);
    return updated;
  }

  async rejectPoint(id: string, moderatorId: string, note?: string) {
    const point = await this.prisma.point.findUnique({ where: { id } });
    if (!point || point.type !== 'offer_help' || point.verificationStatus !== 'pending') {
      throw new NotFoundException('Punto no encontrado o no pendiente');
    }
    const [verification] = await this.prisma.$transaction([
      this.prisma.verification.create({ data: { pointId: id, moderatorId, status: 'rejected', note } }),
      this.prisma.point.update({ where: { id }, data: { verificationStatus: 'rejected', status: 'rejected' } }),
    ]);
    return verification;
  }

  // Verificación oficial de un need_help por un moderador. A diferencia de
  // approvePoint (que publica un offer_help pendiente), aquí el punto YA es
  // público (active); solo se le añade el sello de verificación oficial
  // (verificationStatus → approved) sin cambiar su status ni visibilidad.
  async verifyPoint(id: string, moderatorId: string) {
    const point = await this.prisma.point.findUnique({ where: { id } });
    if (!point || point.type !== 'need_help') {
      throw new NotFoundException('Punto no encontrado');
    }
    if (point.verificationStatus === 'approved') {
      throw new BadRequestException('Este punto ya está verificado');
    }
    const [verification] = await this.prisma.$transaction([
      this.prisma.verification.create({ data: { pointId: id, moderatorId, status: 'approved' } }),
      this.prisma.point.update({ where: { id }, data: { verificationStatus: 'approved' } }),
    ]);
    return verification;
  }

  async getPendingRequests() {
    return this.prisma.moderatorRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async approveRequest(id: string, moderatorId: string) {
    const request = await this.prisma.moderatorRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'pending') {
      throw new NotFoundException('Solicitud no encontrada');
    }
    await this.prisma.$transaction([
      this.prisma.moderatorRequest.update({ where: { id }, data: { status: 'approved', reviewedById: moderatorId, reviewedAt: new Date() } }),
      this.prisma.user.update({ where: { id: request.userId }, data: { role: 'moderator' } }),
    ]);
    return { success: true };
  }

  async rejectRequest(id: string, moderatorId: string) {
    const request = await this.prisma.moderatorRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'pending') {
      throw new NotFoundException('Solicitud no encontrada');
    }
    return this.prisma.moderatorRequest.update({
      where: { id },
      data: { status: 'rejected', reviewedById: moderatorId, reviewedAt: new Date() },
    });
  }
}
