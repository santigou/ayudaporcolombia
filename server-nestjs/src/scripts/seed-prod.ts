import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Bootstrap de PRODUCCIÓN (no destructivo). A diferencia de seed.ts —que borra
// todo y mete datos de demo (juan@, maria@...) y por eso NO se puede correr en
// prod—, este script crea ÚNICAMENTE el moderador inicial a partir de las vars de
// entorno SEED_MODERATOR_EMAIL / SEED_MODERATOR_PASSWORD, y solo si aún no existe
// un usuario con ese email. Seguro de ejecutar en cada arranque del contenedor.
async function main() {
  const prisma = new PrismaClient();
  try {
    const email = process.env.SEED_MODERATOR_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_MODERATOR_PASSWORD;
    if (!email || !password) {
      console.log('🌱 seed-prod: SEED_MODERATOR_EMAIL/PASSWORD sin definir → no se crea moderador.');
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`🌱 seed-prod: ya existe el usuario "${email}" → no se crea nada.`);
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, passwordHash, role: 'moderator' } });
    console.log(`✅ seed-prod: moderador creado ("${email}").`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ seed-prod: error:', e);
  // No abortamos el arranque del servidor por un fallo del seed: el entrypoint
  // continúa y levanta la app igual.
  process.exit(0);
});