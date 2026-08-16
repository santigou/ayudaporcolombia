import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';
import { sha256Hex } from '../../../../shared/infrastructure/utils/crypto.util';

export interface IntegrationRequest extends AuthenticatedRequest {
  // Populado por ApiKeyGuard: el partner autenticado por API key.
  integrationPartner?: {
    id: string;
    slug: string;
    name: string;
    trusted: boolean;
  };
}

// Rutas partner-accesibles ANTES de que un moderador apruebe el partner
// (whoami, mapeos, deliveries): así el partner puede configurarse y ver su
// estado mientras espera la aprobación. POST /points sí exige aprobación.
export const PARTNER_ALLOW_UNAPPROVED = 'partnerAllowUnapproved';
export const AllowUnapprovedPartner = () => SetMetadata(PARTNER_ALLOW_UNAPPROVED, true);

// Guard de las rutas de integración (/api/integrations/v1/*): autentica al
// partner por API key, aceptada como header `X-API-Key` o como
// `Authorization: Bearer apc_...` (así sirve para partners que solo saben
// mandar Bearer). La clave NUNCA se guarda en claro: se busca por su SHA-256.
//
// Convive con el AuthGuard global: estas rutas no llevan @RequireAuth(), así
// que el guard de JWT las deja pasar y este hace la autenticación real.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<IntegrationRequest>();
    const raw = this.extractKey(req);
    if (!raw) {
      throw new UnauthorizedException('Falta la API key (header X-API-Key o Authorization: Bearer <key>)');
    }

    const apiKey = await this.prisma.partnerApiKey.findUnique({
      where: { keyHash: sha256Hex(raw) },
      include: { partner: true },
    });
    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('API key inválida o revocada');
    }
    if (!apiKey.partner.inboundEnabled) {
      // Partner auto-registrado aún no aprobado: solo rutas marcadas con
      // @AllowUnapprovedPartner() (whoami/mappings/deliveries).
      const allowUnapproved = this.reflector.getAllAndOverride<boolean>(PARTNER_ALLOW_UNAPPROVED, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowUnapproved) {
        throw new ForbiddenException(
          'Este partner está deshabilitado para enviarnos puntos (pendiente de aprobación)',
        );
      }
    }

    req.integrationPartner = {
      id: apiKey.partner.id,
      slug: apiKey.partner.slug,
      name: apiKey.partner.name,
      trusted: apiKey.partner.trusted,
    };

    // Refresca lastUsedAt en background: no bloquea ni falla la petición.
    this.prisma.partnerApiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return true;
  }

  private extractKey(req: AuthenticatedRequest): string | null {
    const header = req.headers['x-api-key'];
    if (typeof header === 'string' && header.trim()) return header.trim();
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.substring(7).trim();
    return null;
  }
}