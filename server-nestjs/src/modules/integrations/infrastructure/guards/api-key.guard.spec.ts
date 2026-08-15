import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { sha256Hex } from '../../../../shared/infrastructure/utils/crypto.util';

function createContext(headers: Record<string, string>) {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
    req,
  };
}

const partnerFixture = {
  id: 'partner-1',
  slug: 'app-b',
  name: 'App B',
  trusted: true,
  inboundEnabled: true,
};

describe('ApiKeyGuard', () => {
  let prisma: any;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    prisma = {
      partnerApiKey: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    // Reflector stub: rutas normales (no @AllowUnapprovedPartner → false).
    guard = new ApiKeyGuard(prisma, { getAllAndOverride: () => false } as any);
  });

  it('401 si no hay API key en ningún header', async () => {
    const ctx = createContext({});
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(UnauthorizedException);
  });

  it('autentica por header X-API-Key y popula integrationPartner', async () => {
    const key = 'apc_test123';
    prisma.partnerApiKey.findUnique.mockResolvedValue({
      id: 'key-1',
      keyHash: sha256Hex(key),
      revokedAt: null,
      partner: partnerFixture,
    });
    const ctx = createContext({ 'x-api-key': key });
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    // Busca por hash, nunca por la clave en claro
    expect(prisma.partnerApiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: sha256Hex(key) },
      include: { partner: true },
    });
    expect(ctx.req.integrationPartner).toEqual({
      id: 'partner-1',
      slug: 'app-b',
      name: 'App B',
      trusted: true,
    });
    // Refresca lastUsedAt
    expect(prisma.partnerApiKey.update).toHaveBeenCalled();
  });

  it('autentica también por Authorization: Bearer', async () => {
    const key = 'apc_bearer456';
    prisma.partnerApiKey.findUnique.mockResolvedValue({
      id: 'key-2',
      revokedAt: null,
      partner: partnerFixture,
    });
    const ctx = createContext({ authorization: `Bearer ${key}` });
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect(prisma.partnerApiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: sha256Hex(key) },
      include: { partner: true },
    });
  });

  it('401 si la clave no existe', async () => {
    prisma.partnerApiKey.findUnique.mockResolvedValue(null);
    const ctx = createContext({ 'x-api-key': 'apc_nope' });
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(UnauthorizedException);
  });

  it('401 si la clave está revocada', async () => {
    prisma.partnerApiKey.findUnique.mockResolvedValue({
      id: 'key-3',
      revokedAt: new Date(),
      partner: partnerFixture,
    });
    const ctx = createContext({ 'x-api-key': 'apc_revoked' });
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(UnauthorizedException);
  });

  it('403 si el partner tiene inbound deshabilitado', async () => {
    prisma.partnerApiKey.findUnique.mockResolvedValue({
      id: 'key-4',
      revokedAt: null,
      partner: { ...partnerFixture, inboundEnabled: false },
    });
    const ctx = createContext({ 'x-api-key': 'apc_disabled' });
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(ForbiddenException);
  });
});