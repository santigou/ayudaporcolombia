import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Genera una API key de partner con prefijo reconocible: apc_<40 chars base62>.
// Solo se devuelve UNA vez al crearla; en BD se guarda su hash SHA-256.
export function generateApiKey(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(40);
  let body = '';
  for (let i = 0; i < 40; i++) body += alphabet[bytes[i] % alphabet.length];
  return `apc_${body}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// Deriva una clave AES-256 a partir de cualquier secreto configurado (se hashea
// para que valga cualquier longitud/formato de INTEGRATION_ENCRYPTION_KEY).
export function deriveAesKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

// Cifra con AES-256-GCM (autenticado). Formato: v1:<iv b64>:<tag b64>:<dato b64>.
export function encryptAesGcm(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

// Descifra un secreto AES-256-GCM. Lanza si el formato es inválido o si la
// clave no es la misma con la que se cifró (auth tag no coincide).
export function decryptAesGcm(payload: string, key: Buffer): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Secreto cifrado con formato inválido');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}