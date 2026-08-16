// Limpieza de la simulacion: borra los puntos demo y el partner app-demo.
// El kit queda reutilizable: register.json -> sim\setup.js -> pasos.
require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const links = await p.partnerPointLink.findMany({
    where: { partner: { slug: 'app-demo' } },
    select: { pointId: true },
  });
  for (const l of links) await p.point.delete({ where: { id: l.pointId } }).catch(() => {});
  await p.point.deleteMany({
    where: {
      title: {
        in: [
          'Familia desplazada necesita colchones',
          'Adulto mayor requiere medicamentos',
        ],
      },
    },
  });
  await p.partner.deleteMany({ where: { slug: 'app-demo' } });
  console.log('LIMPIEZA OK | partners:', await p.partner.count(), '| mappings:', await p.partnerMapping.count());
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
