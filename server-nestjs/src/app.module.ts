import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './shared/infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PointsModule } from './modules/points/points.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AuthMiddleware } from './shared/infrastructure/middleware/auth.middleware';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './shared/infrastructure/guards/auth.guard';
import { RolesGuard } from './shared/infrastructure/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    PointsModule,
    ModerationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).exclude('api/auth/login', 'api/auth/register', 'api/points');
  }
}