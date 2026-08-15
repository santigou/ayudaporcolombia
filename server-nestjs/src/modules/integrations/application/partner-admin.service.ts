import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Partner } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { generateApiKey, sha256Hex } from '../../../shared/infrastructure/utils/crypto.util';
import { SecretsService } from '../infrastructure/secrets.service';

// Datos de escritura de un partner (create/patch). Los secretos en claro
// (`outboundApiKeyValue`, `loginEmail`, `loginPassword`) solo ENTRAN por aquí:
// se cifran y jamás se devuelven (la lectura usa máscaras).
export interface PartnerWriteInput {
  slug?: string;
  name?: string;
  contactEmail?: string | null;
  trusted?: boolean;
  inboundEnabled?: boolean;
  outboundEnabled?: boolean;
  sendOnCreated?: boolean;
  sendOnUpdated?: boolean;
  outboundUrl?: string | null;
  authType?: 'api_key' | 'login';
  outboundHeaderName?: string | null;
  outboundApiKeyValue?: string | null;
  loginUrl?: string | null;
  loginEmail?: string | null;
  loginPassword?: string | null;
  tokenJsonPath?: string | null;
  tokenHeader?: string | null;
}

// Administración de partners y API keys (solo moderadores): crea/edita
// partners, emite/revoca API keys (hash en BD, la clave se muestra UNA vez) y
// da observabilidad de la cola de sincronización con reintento manual.
@Injectable()
export class PartnerAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
  ) {}

  async createPartner(data: PartnerWriteInput) {
    const { outboundApiKeyValue, loginEmail, loginPassword, ...rest } = data;
    const payload: any = {
      ...rest,
      ...(data.slug ? { slug: data.slug.toLowerCase() } : {}),
    };
    if (outboundApiKeyValue !== undefined && outboundApiKeyValue !== null) {
      payload.outboundApiKeyValueEnc = this.secrets.encrypt(outboundApiKeyValue);
    }
    if (loginEmail !== undefined && loginEmail !== null) payload.loginEmailEnc = this.secrets.encrypt(loginEmail);
    if (loginPassword !== undefined && loginPassword !== null) {
      payload.loginPasswordEnc = this.secrets.encrypt(loginPassword);
    }
    try {
      const partner = await this.prisma.partner.create({ data: payload });
      return this.toView(partner);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException(`Ya existe un partner con slug "${data.slug}"`);
      throw err;
    }
  }

  async listPartners(opts?: { pending?: boolean }) {
    const partners = await this.prisma.partner.findMany({
      where: opts?.pending ? { approvedAt: null } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return partners.map((p) => this.toView(p));
  }

  async getPartner(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner no encontrado');
    return this.toView(partner);
  }

  async updatePartner(id: string, patch: PartnerWriteInput) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner no encontrado');
    const { outboundApiKeyValue, loginEmail, loginPassword, ...rest } = patch;
    const data: any = { ...rest };
    if (outboundApiKeyValue !== undefined) {
      data.outboundApiKeyValueEnc = outboundApiKeyValue ? this.secrets.encrypt(outboundApiKeyValue) : null;
    }
    if (loginEmail !== undefined) data.loginEmailEnc = loginEmail ? this.secrets.encrypt(loginEmail) : null;
    if (loginPassword !== undefined) {
      data.loginPasswordEnc = loginPassword ? this.secrets.encrypt(loginPassword) : null;
    }
    const partner = await this.prisma.partner.update({ where: { id }, data });
    return this.toView(partner);
  }

  // Borra el partner y (en cascada) sus API keys, links y logs de sincronización.
  async removePartner(id: string) {
    const existing = await this.prisma.partner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner no encontrado');
    await this.prisma.partner.delete({ where: { id } });
    return { id, deleted: true };
  }

  // Emite una API key para el partner. La clave completa se devuelve UNA sola
  // vez: en BD solo queda el hash SHA-256 y el prefijo para reconocerla.
  async createApiKey(partnerId: string, name: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner no encontrado');
    const key = generateApiKey();
    const apiKey = await this.prisma.partnerApiKey.create({
      data: { partnerId, name, prefix: key.slice(0, 12), keyHash: sha256Hex(key) },
    });
    return { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, createdAt: apiKey.createdAt, key };
  }

  async listApiKeys(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner no encontrado');
    const keys = await this.prisma.partnerApiKey.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
    }));
  }

  async revokeApiKey(partnerId: string, keyId: string) {
    const apiKey = await this.prisma.partnerApiKey.findFirst({ where: { id: keyId, partnerId } });
    if (!apiKey) throw new NotFoundException('API key no encontrada');
    if (apiKey.revokedAt) return { id: apiKey.id, revoked: true };
    await this.prisma.partnerApiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    return { id: keyId, revoked: true };
  }

  async listSyncLogs(opts: { status?: string; partnerId?: string; limit?: number }) {
    const where: any = {};
    if (opts.status && ['pending', 'processing', 'delivered', 'failed', 'skipped'].includes(opts.status)) {
      where.status = opts.status;
    }
    if (opts.partnerId) where.partnerId = opts.partnerId;
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
    return this.prisma.partnerSyncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        partner: { select: { slug: true, name: true } },
        point: { select: { code: true, title: true } },
      },
    });
  }

  // Reintento manual (moderador): resetea el job a pending para que el worker
  // lo procese ya mismo. Aplica a failed/skipped e incluso delivered (re-envío).
  async retrySyncLog(id: string) {
    const log = await this.prisma.partnerSyncLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Job de sincronización no encontrado');
    if (log.status === 'pending' || log.status === 'processing') {
      throw new BadRequestException('El job ya está en cola o en proceso');
    }
    return this.prisma.partnerSyncLog.update({
      where: { id },
      data: { status: 'pending', attempts: 0, nextAttemptAt: null, lastError: null },
    });
  }

  // Aprueba un partner auto-registrado desde el portal: su API key pasa a
  // poder enviarnos puntos (entrarán a moderación salvo que además sea trusted).
  // Idempotente: aprobar dos veces no cambia nada.
  async approvePartner(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner no encontrado');
    const updated = await this.prisma.partner.update({
      where: { id },
      data: { inboundEnabled: true, ...(partner.approvedAt ? {} : { approvedAt: new Date() }) },
    });
    return this.toView(updated);
  }

  // Vista segura: nunca devuelve secretos en claro (solo máscara/flags).
  private toView(p: Partner) {
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      contactEmail: p.contactEmail,
      approvedAt: p.approvedAt,
      trusted: p.trusted,
      inboundEnabled: p.inboundEnabled,
      outboundEnabled: p.outboundEnabled,
      sendOnCreated: p.sendOnCreated,
      sendOnUpdated: p.sendOnUpdated,
      outboundUrl: p.outboundUrl,
      authType: p.authType,
      outboundHeaderName: p.outboundHeaderName,
      outboundApiKey: p.outboundApiKeyValueEnc
        ? SecretsService.mask(this.secrets.decrypt(p.outboundApiKeyValueEnc))
        : null,
      loginUrl: p.loginUrl,
      loginEmail: p.loginEmailEnc ? SecretsService.mask(this.secrets.decrypt(p.loginEmailEnc)) : null,
      hasLoginPassword: !!p.loginPasswordEnc,
      tokenJsonPath: p.tokenJsonPath,
      tokenHeader: p.tokenHeader,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}