import { Module } from '@nestjs/common';
import { PointsController } from './infrastructure/controllers/points.controller';
import { PrismaPointRepository } from './infrastructure/repositories/prisma-point.repository';
import { PointRepository } from './application/interfaces/point.repository.interface';
import { CreatePointUseCase } from './application/use-cases/create-point.use-case';
import { GetPointsUseCase } from './application/use-cases/get-points.use-case';
import { ApprovePointUseCase } from './application/use-cases/approve-point.use-case';
import { PrismaModule } from '../../shared/infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PointsController],
  providers: [
    {
      provide: PointRepository,
      useClass: PrismaPointRepository,
    },
    CreatePointUseCase,
    GetPointsUseCase,
    ApprovePointUseCase,
  ],
  exports: [PointRepository],
})
export class PointsModule {}