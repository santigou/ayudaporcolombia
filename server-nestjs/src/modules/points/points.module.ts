import { Module } from '@nestjs/common';
import { PointsController } from './infrastructure/controllers/points.controller';
import { PointService } from './application/point.service';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PointsController],
  providers: [PointService],
})
export class PointsModule {}
