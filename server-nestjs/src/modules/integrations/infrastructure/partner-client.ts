import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Partner } from '@prisma/client';
import { intConfig } from '../../../shared/infrastructure/utils/config.util';
import { SecretsService } from './secrets.service';

export interface DeliverResult {
  httpStatus: number;
  // ID que el partner asignó al punto en SU sistema (si lo devuelve en el
  // body como `id`); se guarda en PartnerPointLink para trazabilidad.
  externalId: string | null;
  body: unknown;
}

// Extrae un valor anidado por path de puntos: extractJsonPath(body, 'data.token').
export function extractJsonPath(value: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), value);
}

// Cliente HTTP hacia los partners (webhooks outbound). Soporta dos estrategias
// de autenticación, configuradas por partner:
//
//  1. api_key: header configurable (outboundHeaderName, default X-API-Key) con
//     el valor descifrado de outboundApiKeyValueEnc.
//  2. login: POST a loginUrl con {email, password} (cifradas en BD), extrae el
//     token con tokenJsonPath (default "token"), lo cachea en memoria y lo
//     envía como `Authorization: Bearer <token>` (header configurable). Si el
//     webhook responde 401/403, invalida el token, re-loguea y reintenta UNA vez.
@Injectable()
export class PartnerClient {
  private readonly logger = new Logger(PartnerClient.name);
  // partnerId → token del modo login (cache en memoria del proceso).
  private readonly tokens = new Map<string, string>();

  constructor(
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
  ) {}

  async deliver(partner: Partner, payload: unknown): Promise<DeliverResult> {
    return this.post(partner, payload, true);
  }

  private async post(partner: Partner, payload: unknown, allowRelogin: boolean): Promise<DeliverResult> {
    if (!partner.outboundUrl) {
      throw new Error(`Partner ${partner.slug}: no tiene outboundUrl configurada`);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (partner.authType === 'api_key') {
      if (!partner.outboundApiKeyValueEnc) {
        throw new Error(`Partner ${partner.slug}: no tiene API key outbound configurada`);
      }
      headers[partner.outboundHeaderName || 'X-API-Key'] = this.secrets.decrypt(partner.outboundApiKeyValueEnc);
    } else {
      const token = await this.ensureToken(partner);
      headers[partner.tokenHeader || 'Authorization'] = `Bearer ${token}`;
    }

    const timeoutMs = intConfig(this.config, 'INTEGRATION_OUTBOUND_TIMEOUT_MS', 10000);
    let res: Response;
    try {
      res = await fetch(partner.outboundUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      const reason = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `timeout tras ${timeoutMs}ms`
        : err?.message ?? String(err);
      throw new Error(`Partner ${partner.slug}: ${reason}`);
    }

    const text = await res.text().catch(() => '');

    // Token expirado/inválido en modo login: re-autentica y reintenta UNA vez.
    if ((res.status === 401 || res.status === 403) && partner.authType === 'login' && allowRelogin) {
      this.tokens.delete(partner.id);
      this.logger.warn(`Partner ${partner.slug}: HTTP ${res.status} → re-autenticando y reintentando`);
      return this.post(partner, payload, false);
    }

    if (!res.ok) {
      throw new Error(`Partner ${partner.slug}: HTTP ${res.status} ${text.slice(0, 200)}`);
    }

    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    const remoteId = extractJsonPath(body, 'id');
    return {
      httpStatus: res.status,
      externalId: typeof remoteId === 'string' || typeof remoteId === 'number' ? String(remoteId) : null,
      body,
    };
  }

  private async ensureToken(partner: Partner): Promise<string> {
    const cached = this.tokens.get(partner.id);
    if (cached) return cached;

    if (!partner.loginUrl || !partner.loginEmailEnc || !partner.loginPasswordEnc) {
      throw new Error(`Partner ${partner.slug}: credenciales de login incompletas (loginUrl/loginEmail/loginPassword)`);
    }

    const timeoutMs = intConfig(this.config, 'INTEGRATION_OUTBOUND_TIMEOUT_MS', 10000);
    let res: Response;
    try {
      res = await fetch(partner.loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.secrets.decrypt(partner.loginEmailEnc),
          password: this.secrets.decrypt(partner.loginPasswordEnc),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      throw new Error(`Partner ${partner.slug}: login falló (${err?.message ?? err})`);
    }
    if (!res.ok) {
      throw new Error(`Partner ${partner.slug}: login devolvió HTTP ${res.status}`);
    }

    const body = await res.json().catch(() => null);
    const token = extractJsonPath(body, partner.tokenJsonPath || 'token');
    if (typeof token !== 'string' || !token) {
      throw new Error(`Partner ${partner.slug}: login ok pero no se encontró token en "${partner.tokenJsonPath || 'token'}"`);
    }
    this.tokens.set(partner.id, token);
    return token;
  }
}