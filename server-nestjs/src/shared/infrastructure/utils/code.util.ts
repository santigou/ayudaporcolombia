import { PrismaService } from '../database/prisma.service';

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) para códigos legibles.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5; // 31^5 ≈ 28M combinaciones → colisión muy improbable

// Genera un código corto legible, p. ej. "AYUDA-K7XQ2". Reintenta si colisiona
// (caso extremo por el constraint unique) hasta encontrar uno libre.
export async function generateUniqueCode(prisma: PrismaService): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `AYUDA-${randomString(CODE_LENGTH)}`;
    const exists = await prisma.point.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  return `AYUDA-${randomString(CODE_LENGTH)}${randomString(2)}`;
}

function randomString(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
