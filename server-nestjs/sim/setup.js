// Setup de la simulacion: aprueba App Demo y activa su outbound hacia el mock.
require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

function encrypt(plain) {
  const key = crypto.createHash('sha256').update(process.env.INTEGRATION_ENCRYPTION_KEY, 'utf8').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

(async () => {
  await p.partner.update({
    where: { slug: 'app-demo' },
    data: {
      approvedAt: new Date(),
      inboundEnabled: true,
      trusted: true, // para ver publicacion inmediata
      outboundEnabled: true,
      sendOnCreated: true,
      outboundUrl: 'http://localhost:4999/webhook',
      authType: 'api_key',
      outboundHeaderName: 'X-Api-Key',
      outboundApiKeyValueEnc: encrypt('secreto-de-app-demo'),
    },
  });
  const partner = await p.partner.findUnique({ where: { slug: 'app-demo' } });
  console.log('SETUP OK:', partner.slug, '| aprobado:', !!partner.approvedAt, '| trusted:', partner.trusted, '| outbound:', partner.outboundUrl);
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
