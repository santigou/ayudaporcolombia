import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PointsGateway } from './points.gateway';

@Module({
  // JwtModule (mismo secret que AuthModule) para verificar el JWT del handshake
  // del socket. Así valen las mismas cookies httpOnly que ya usa el cliente.
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
      }),
    }),
  ],
  providers: [PointsGateway],
  exports: [PointsGateway],
})
export class RealtimeModule {}
