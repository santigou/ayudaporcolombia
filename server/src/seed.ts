import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./lib/password.js";

async function main() {
  const name = process.env.SEED_MODERATOR_NAME;
  const email = process.env.SEED_MODERATOR_EMAIL;
  const password = process.env.SEED_MODERATOR_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Define SEED_MODERATOR_NAME, SEED_MODERATOR_EMAIL y SEED_MODERATOR_PASSWORD en .env antes de sembrar",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Ya existe un usuario con el correo ${email} (rol actual: ${existing.role})`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "moderator" },
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
