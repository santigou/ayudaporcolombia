import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./lib/password.js";

// Semilla del primer moderador.
//
// Nota: en el rediseño del modelo, `User` ya no tiene `name` ni `contactInfo`,
// por lo que el moderador se crea únicamente con email + contraseña.
// Si defines `SEED_MODERATOR_NAME` en el .env simplemente se ignora.
async function main() {
  const email = process.env.SEED_MODERATOR_EMAIL;
  const password = process.env.SEED_MODERATOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Define SEED_MODERATOR_EMAIL y SEED_MODERATOR_PASSWORD en .env antes de sembrar",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Ya existe un usuario con el correo ${email} (rol actual: ${existing.role})`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "moderator" },
  });
  console.log(`Moderador creado: ${user.email} (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
