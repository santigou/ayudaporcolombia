import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptAesGcm, deriveAesKey, encryptAesGcm } from '../../../shared/infrastructure/utils/crypto.util';

// Cifra/descifra las credenciales outbound de los partners (API key, email,
// password) con AES-256-GCM usando INTEGRATION_ENCRYPTION_KEY. Los secretos
// NUNCA se guardan ni se devuelven en claro: en BD van cifrados y por la API
// solo se ve la máscara (••••1234).
@Injectable()
export class SecretsService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const secret = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY');
    if (!secret) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY no está configurada (necesaria para cifrar credenciales de partners)');
    }
    return deriveAesKey(secret);
  }

  encrypt(plain: string): string {
    return encryptAesGcm(plain, this.key());
  }

  decrypt(payload: string): string {
    return decryptAesGcm(payload, this.key());
  }

  // Máscara para respuestas de admin: solo deja ver los últimos 4 caracteres.
  static mask(plain: string | null | undefined): string | null {
    if (!plain) return null;
    return `••••${plain.slice(-4)}`;
  }
}