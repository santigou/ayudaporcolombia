import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PointsModule } from './modules/points/points.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AuthMiddleware } from './shared/infrastructure/middleware/auth.middleware';
import { AuthGuard, RolesGuard } from './shared/infrastructure/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    PointsModule,
    ModerationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  // El middleware de auth es OPCIONAL y se aplica a todas las rutas: popula
  // req.user si hay JWT válido, pero no bloquea el acceso.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
