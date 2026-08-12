import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS configuration
  const clientOrigin = configService.get<string>('CLIENT_ORIGIN') || 'http://localhost:5173';
  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Set prefix for all routes
  app.setGlobalPrefix('');

  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);

  console.log(`🚀 Server is running on: http://localhost:${port}`);
  console.log(`📝 Environment: ${configService.get('NODE_ENV') || 'development'}`);
  console.log(`🔗 Client origin: ${clientOrigin}`);
}

bootstrap();