import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Limpieza completa y ordenada (respetando FKs) para que el seed sea idempotente.
  await prisma.attachment.deleteMany();
  await prisma.pointUpdate.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.validation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pointSupply.deleteMany();
  await prisma.pointLocation.deleteMany();
  await prisma.point.deleteMany();
  await prisma.location.deleteMany();
  await prisma.supply.deleteMany();
  await prisma.helpType.deleteMany();
  await prisma.moderatorRequest.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleaned existing data');

  const moderatorPassword = await bcrypt.hash('Admin123!', 10);
  const moderator = await prisma.user.create({
    data: { email: 'moderator@ayudaporcolombia.co', passwordHash: moderatorPassword, role: 'moderator' },
  });
  console.log(`✅ Created moderator: ${moderator.email}`);

  const user1Password = await bcrypt.hash('User123!', 10);
  const user1 = await prisma.user.create({
    data: { email: 'juan@example.com', passwordHash: user1Password, role: 'user' },
  });

  const user2Password = await bcrypt.hash('User123!', 10);
  const user2 = await prisma.user.create({
    data: {
      email: 'maria@example.com', passwordHash: user2Password, role: 'user',
      moderatorRequests: { create: { status: 'pending' } },
    },
  });
  console.log(`✅ Created users: ${user1.email}, ${user2.email}`);

  const foodType = await prisma.helpType.upsert({ where: { name: 'Alimentos' }, update: {}, create: { name: 'Alimentos', description: 'Donación de alimentos' } });
  await prisma.helpType.upsert({ where: { name: 'Agua' }, update: {}, create: { name: 'Agua', description: 'Suministro de agua' } });
  await prisma.helpType.upsert({ where: { name: 'Refugio' }, update: {}, create: { name: 'Refugio', description: 'Alojamiento temporal' } });
  await prisma.helpType.upsert({ where: { name: 'Médico' }, update: {}, create: { name: 'Médico', description: 'Atención médica' } });

  const location1 = await prisma.location.create({ data: { city: 'Bogotá', neighborhood: 'Chapinero', address: 'Calle 45 # 12-34', latitude: 4.6533, longitude: -74.0835 } });
  const location2 = await prisma.location.create({ data: { city: 'Medellín', neighborhood: 'El Poblado', address: 'Carrera 10 # 32-56', latitude: 6.2575, longitude: -75.5647 } });

  const foodSupply = await prisma.supply.create({ data: { name: 'Arroz' } });

  const p1 = await prisma.point.create({
    data: {
      code: 'K7XQ2A9B', type: 'need_help', title: 'Familia necesita alimentos',
      description: 'Familia de 4 personas necesita ayuda inmediata con alimentos y agua.',
      status: 'active', verificationStatus: 'approved', createdById: user1.id,
      locations: { create: { locationId: location1.id, locationType: 'location' } },
      contacts: { create: { type: 'whatsapp', value: '+57 300 123 4567', isPublic: true } },
    },
  });

  const p2 = await prisma.point.create({
    data: {
      code: 'PT8M2K5Q', type: 'offer_help', title: 'Centro de acopio disponible',
      description: 'Espacio disponible para recibir donaciones de alimentos.',
      helpTypeId: foodType.id, status: 'active', verificationStatus: 'approved', createdById: user2.id,
      locations: { create: { locationId: location2.id, locationType: 'location' } },
      contacts: { create: [{ type: 'phone', value: '+57 310 987 6543', isPublic: true }, { type: 'email', value: 'contacto@ayuda.example.com', isPublic: true }] },
      supplies: { create: { supplyId: foodSupply.id, targetQuantity: 100, unit: 'kg' } },
    },
  });
  console.log(`✅ Created points: ${p1.title}, ${p2.title}`);
  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
