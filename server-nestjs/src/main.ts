import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyIntegrationSchemas } from './modules/integrations/infrastructure/swagger-schemas';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';
import * as fs from 'fs';
import { json } from 'express';
import type { Request, Response, NextFunction } from 'express';
// Carga el .env con ruta ABSOLUTA (relativa a este archivo) antes que nada,
// para que Prisma y los módulos encuentren DATABASE_URL sin depender del CWD.
// Compila a dist/main.js → sube un nivel para llegar a server-nestjs/.env.
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // CORS configuration (con credenciales para la cookie httpOnly del JWT).
  const clientOrigin = configService.get<string>('CLIENT_ORIGIN') || 'http://localhost:5173';
  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  // Adaptador de WebSockets (Socket.IO) para el chat en tiempo real de la
  // pestaña "Novedades". Si hay REDIS_URL, usa el adapter de Redis (Pub/Sub) para
  // que el broadcast funcione con varios contenedores backend (escalado
  // horizontal). Si no, cae al IoAdapter normal (suficiente para 1 solo servidor).
  const redisUrl = configService.get<string>('REDIS_URL');
  if (redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisIoAdapter);
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  // Cookie parser: necesario para leer la cookie `token` (JWT) en el middleware.
  app.use(cookieParser());

  // Body parser con límite amplio para FormData con fotos en base64 si llegara.
  app.use(json({ limit: '15mb' }));

  // Global validation pipe.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // multipart/FormData envía campos extra
      transform: true,
    }),
  );

  // Ficheros estáticos: fotos subidas a /uploads. Solo en modo local (dev):
  // en producción las fotos se sirven desde el CDN de SeaweedFS.
  const storageDriver = configService.get<string>('STORAGE_DRIVER') || 'local';
  if (storageDriver.toLowerCase() !== 'seaweedfs') {
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  }

  // En producción, sirve el SPA de React compilado (client/dist) y deja el
  // fallback a index.html para que React Router maneje las rutas (p. ej.
  // /moderador, /p/:code). En dev, Vite sirve el cliente por separado (:5173).
  const clientDist = path.join(process.cwd(), '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.useStaticAssets(clientDist);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.match(/\.[^/]+$/)) {
        res.sendFile(path.join(clientDist, 'index.html'));
        return;
      }
      next();
    });
  }

  // Swagger UI público en /api/docs: la referencia interactiva de la API para
  // los developers de las apps partner (y para nosotros). Documenta los dos
  // esquemas de auth: API key de partner (X-API-Key) y JWT de usuario/cookie.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ayuda por Colombia API')
    .setDescription(
      'API del hub de federación de puntos de ayuda. Partners: véase ' +
        '`Partners (portal)` para registrar tu app, `Integraciones v1` para enviar/recibir puntos ' +
        'y `Partners · Mapeos` para adaptar tu formato con expresiones JSONata. ' +
        'Documentación narrativa: docs/obsidian/Integraciones partner.md y ' +
        'docs/obsidian/Mapeos por expresiones (JSONata).md.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header', description: 'API key de partner (apc_...)' }, 'ApiKeyAuth')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT de usuario (también vale la cookie `token`)' }, 'bearerJWT')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Enums y contratos canónicos reutilizables (PointType, LocationType,
  // CanonicalEnvelope...) como componentes $ref: visibles en la sección
  // "Schemas" de la UI y referenciados por los endpoints de integración.
  applyIntegrationSchemas(document);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });

  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);

  console.log(`🚀 Server is running on: http://localhost:${port}`);
  console.log(`📝 Environment: ${configService.get('NODE_ENV') || 'development'}`);
  console.log(`🔗 Client origin: ${clientOrigin}`);

  // En PM2 cluster mode: avisa al proceso master que este worker ya acepta
  // tráfico. PM2 (con wait_ready:true en ecosystem.config.js) espera esta señal
  // antes de enrutarle peticiones. Fuera de PM2 (dev con nest start) esto es un
  // no-op porque process.send es undefined.
  if (process.send) {
    process.send('ready');
  }
}

bootstrap();
