import { Module } from '@nestjs/common';
import { PointsController } from './infrastructure/controllers/points.controller';
import { PointService } from './application/point.service';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  // RealtimeModule expone PointsGateway para que PointService pueda difundir las
  // novedades nuevas por Socket.IO tras crearlas.
  imports: [PrismaModule, RealtimeModule],
  controllers: [PointsController],
  providers: [PointService],
})
export class PointsModule {}
