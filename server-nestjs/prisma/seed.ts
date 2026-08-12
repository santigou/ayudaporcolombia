import { PrismaClient } from '@prisma/client';
import { AuthService } from '../src/modules/auth/domain/services/auth.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.point.deleteMany();
  await prisma.moderatorRequest.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleaned existing data');

  // Create default moderator
  const moderatorPassword = await AuthService.hashPassword('Admin123!');
  const moderator = await prisma.user.create({
    data: {
      name: 'Admin Moderator',
      email: 'moderator@ayudaporcolombia.co',
      passwordHash: moderatorPassword,
      role: 'moderator',
      contactInfo: 'Main system administrator',
    },
  });
  console.log(`✅ Created moderator: ${moderator.email}`);

  // Create regular users
  const user1Password = await AuthService.hashPassword('User123!');
  const user1 = await prisma.user.create({
    data: {
      name: 'Juan Pérez',
      email: 'juan@example.com',
      passwordHash: user1Password,
      role: 'user',
      contactInfo: 'WhatsApp: +57 300 123 4567',
    },
  });

  const user2Password = await AuthService.hashPassword('User123!');
  const user2 = await prisma.user.create({
    data: {
      name: 'María García',
      email: 'maria@example.com',
      passwordHash: user2Password,
      role: 'user',
      contactInfo: 'Phone: +57 310 987 6543',
      moderatorRequest: {
        create: {
          status: 'pending',
        },
      },
    },
  });
  console.log(`✅ Created users: ${user1.email}, ${user2.email}`);

  // Create help types
  const foodType = await prisma.helpType.create({
    data: {
      name: 'Alimentos',
      description: 'Donación de alimentos no perecederos',
    },
  });

  const waterType = await prisma.helpType.create({
    data: {
      name: 'Agua',
      description: 'Suministro de agua potable',
    },
  });

  const medicalType = await prisma.helpType.create({
    data: {
      name: 'Ayuda Médica',
      description: 'Atención médica y suministros médicos',
    },
  });
  console.log(`✅ Created help types: ${foodType.name}, ${waterType.name}, ${medicalType.name}`);

  // Create locations
  const location1 = await prisma.location.create({
    data: {
      city: 'Bogotá',
      neighborhood: 'Chapinero',
      address: 'Calle 45 # 12-34',
      latitude: 4.6533,
      longitude: -74.0835,
    },
  });

  const location2 = await prisma.location.create({
    data: {
      city: 'Medellín',
      neighborhood: 'El Poblado',
      address: 'Carrera 10 # 32-56',
      latitude: 6.2575,
      longitude: -75.5647,
    },
  });
  console.log(`✅ Created locations: ${location1.city}, ${location2.city}`);

  // Create supplies
  const foodSupply = await prisma.supply.create({
    data: {
      name: 'Arroz',
    },
  });

  const waterSupply = await prisma.supply.create({
    data: {
      name: 'Agua embotellada',
    },
  });
  console.log(`✅ Created supplies: ${foodSupply.name}, ${waterSupply.name}`);

  // Create sample points
  const point1 = await prisma.point.create({
    data: {
      type: 'need_help',
      title: 'Familia necesita alimentos',
      description: 'Familia de 4 personas necesita ayuda inmediata con alimentos y agua debido a la emergencia.',
      status: 'active',
      verificationStatus: 'approved',
      createdById: user1.id,
      locations: {
        create: {
          locationId: location1.id,
          locationType: 'location',
        },
      },
      contacts: {
        create: {
          type: 'whatsapp',
          value: '+57 300 123 4567',
          isPublic: true,
        },
      },
    },
  });

  const point2 = await prisma.point.create({
    data: {
      type: 'offer_help',
      title: 'Centro de acopio disponible',
      description: 'Contamos con espacio disponible para recibir donaciones de alimentos y suministros médicos.',
      helpTypeId: foodType.id,
      status: 'active',
      verificationStatus: 'approved',
      createdById: user2.id,
      locations: {
        create: {
          locationId: location2.id,
          locationType: 'location',
        },
      },
      contacts: {
        create: [
          {
            type: 'phone',
            value: '+57 310 987 6543',
            isPublic: true,
          },
          {
            type: 'email',
            value: 'contacto@ayuda.example.com',
            isPublic: true,
          },
        ],
      },
      supplies: {
        create: {
          supplyId: foodSupply.id,
          targetQuantity: 100,
          unit: 'kg',
        },
      },
    },
  });
  console.log(`✅ Created sample points: ${point1.title}, ${point2.title}`);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });