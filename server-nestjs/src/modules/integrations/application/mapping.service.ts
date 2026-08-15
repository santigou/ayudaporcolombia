import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { inboundPointSchema, zodFirstError } from '../domain/canonical.schema';
import { MappingEngine } from '../infrastructure/mapping-engine/engine';

export interface CreateMappingInput {
  direction: 'inbound' | 'outbound';
  definition: unknown;
  notes?: string | null;
  activate?: boolean;
}

export interface DryRunInput {
  direction: 'inbound' | 'outbound';
  definition?: unknown;
  mappingId?: string;
  sampleInput: unknown;
}

// Gestión de mapeos declarativos (self-service del partner vía API key):
// versionado (UNA versión activa por dirección), activación/rollback y dry-run
// de prueba SIN guardar. El moderador tiene vistas de auditoría y una válvula
// de emergencia (desactivar a la fuerza) — ver PartnerAdminService-ish controllers.
@Injectable()
export class MappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: MappingEngine,
  ) {}

  async create(partnerId: string, input: CreateMappingInput) {
    this.assertDefinition(input.definition);
    // Chequeo de sintaxis: evalúa contra input vacío; una expresión inválida
    // revienta aquí (con {} las expresiones válidas devuelven undefined/null).
    try {
      await this.engine.evaluate(input.definition, {});
    } catch (err: any) {
      throw new BadRequestException(`definition inválida: ${err?.message ?? err}`);
    }

    const last = await this.prisma.partnerMapping.findFirst({
      where: { partnerId, direction: input.direction },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    if (input.activate) {
      await this.prisma.partnerMapping.updateMany({
        where: { partnerId, direction: input.direction, isActive: true },
        data: { isActive: false },
      });
    }

    return this.prisma.partnerMapping.create({
      data: {
        partnerId,
        direction: input.direction,
        version,
        definition: input.definition as object,
        notes: input.notes ?? null,
        isActive: !!input.activate,
      },
    });
  }

  async list(partnerId: string, direction?: 'inbound' | 'outbound') {
    return this.prisma.partnerMapping.findMany({
      where: { partnerId, ...(direction ? { direction } : {}) },
      orderBy: [{ direction: 'asc' }, { version: 'desc' }],
    });
  }

  async getOne(partnerId: string, id: string) {
    const mapping = await this.prisma.partnerMapping.findFirst({ where: { id, partnerId } });
    if (!mapping) throw new NotFoundException('Mapeo no encontrado');
    return mapping;
  }

  // Activa una versión (desactiva las demás de esa dirección). Activar una
  // versión vieja = rollback inmediato.
  async activate(partnerId: string, id: string) {
    const mapping = await this.getOne(partnerId, id);
    await this.prisma.partnerMapping.updateMany({
      where: { partnerId, direction: mapping.direction, isActive: true },
      data: { isActive: false },
    });
    return this.prisma.partnerMapping.update({ where: { id }, data: { isActive: true } });
  }

  async remove(partnerId: string, id: string) {
    const mapping = await this.getOne(partnerId, id);
    if (mapping.isActive) {
      throw new BadRequestException('No se puede borrar la versión activa (activa otra primero)');
    }
    await this.prisma.partnerMapping.delete({ where: { id } });
    return { id, deleted: true };
  }

  // Prueba SIN guardar: evalúa una definition inline (o una versión existente
  // por mappingId) contra un sampleInput y devuelve el resultado. En inbound
  // además valida el resultado contra el esquema canónico (lo mismo que
  // pasará en producción) para detectar errores antes de activar.
  async dryRun(partnerId: string, input: DryRunInput) {
    let definition = input.definition;
    if (definition == null) {
      if (!input.mappingId) throw new BadRequestException('definition o mappingId es requerido');
      definition = (await this.getOne(partnerId, input.mappingId)).definition;
    }
    this.assertDefinition(definition);

    let result: unknown;
    try {
      result = await this.engine.evaluate(definition, input.sampleInput ?? {});
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err), result: null };
    }

    let canonicalCheck: { valid: boolean; error?: string } | null = null;
    if (input.direction === 'inbound') {
      const parsed = inboundPointSchema.safeParse(result);
      canonicalCheck = parsed.success
        ? { valid: true }
        : { valid: false, error: zodFirstError(parsed.error) };
    }
    return { ok: true, result, canonicalCheck };
  }

  // --- Moderador (auditoría + válvula de emergencia) ---

  async adminList(partnerId: string) {
    return this.list(partnerId);
  }

  async adminDeactivate(partnerId: string, mappingId: string) {
    await this.getOne(partnerId, mappingId);
    return this.prisma.partnerMapping.update({ where: { id: mappingId }, data: { isActive: false } });
  }

  private assertDefinition(definition: unknown): void {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new BadRequestException('definition debe ser un objeto JSON (plantilla de mapeo)');
    }
  }
}