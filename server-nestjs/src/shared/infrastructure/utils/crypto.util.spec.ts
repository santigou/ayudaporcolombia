import {
  decryptAesGcm,
  deriveAesKey,
  encryptAesGcm,
  generateApiKey,
  sha256Hex,
} from './crypto.util';

describe('crypto.util', () => {
  it('genera API keys con prefijo apc_ y 44 caracteres', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^apc_[A-Za-z0-9]{40}$/);
    // Aleatoriedad: dos llamadas no devuelven lo mismo.
    expect(key).not.toBe(generateApiKey());
  });

  it('sha256Hex es determinista y hexadecimal', () => {
    expect(sha256Hex('hola')).toBe(sha256Hex('hola'));
    expect(sha256Hex('hola')).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Hex('hola')).not.toBe(sha256Hex('holas'));
  });

  it('cifra y descifra con AES-256-GCM (roundtrip)', () => {
    const key = deriveAesKey('secreto-de-prueba');
    const enc = encryptAesGcm('api-key-super-secreta', key);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain('api-key-super-secreta');
    expect(decryptAesGcm(enc, key)).toBe('api-key-super-secreta');
  });

  it('cifrado con IV aleatorio: dos cifrados del mismo texto difieren', () => {
    const key = deriveAesKey('k');
    expect(encryptAesGcm('x', key)).not.toBe(encryptAesGcm('x', key));
  });

  it('falla al descifrar con otra clave (auth tag)', () => {
    const enc = encryptAesGcm('secreto', deriveAesKey('clave-1'));
    expect(() => decryptAesGcm(enc, deriveAesKey('clave-2'))).toThrow();
  });

  it('falla con payload con formato inválido', () => {
    expect(() => decryptAesGcm('garbage', deriveAesKey('k'))).toThrow('formato inválido');
  });
});