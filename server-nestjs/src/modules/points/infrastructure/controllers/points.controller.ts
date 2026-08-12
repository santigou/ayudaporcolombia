import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { CreatePointUseCase } from '../../application/use-cases/create-point.use-case';
import { GetPointsUseCase } from '../../application/use-cases/get-points.use-case';
import { ApprovePointUseCase } from '../../application/use-cases/approve-point.use-case';
import { CreatePointDto, CreatePointDtoSchema } from '../../application/dto/create-point.dto';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard, RolesGuard, AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { Roles, RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { PointMapper } from '../mappers/point.mapper';
import { Role, PointType } from '../../../../shared/domain/enums';

@Controller('api/points')
export class PointsController {
  constructor(
    private readonly createPointUseCase: CreatePointUseCase,
    private readonly getPointsUseCase: GetPointsUseCase,
    private readonly approvePointUseCase: ApprovePointUseCase,
  ) {}

  @Get()
  async getPublicPoints(@Query('type') type?: string) {
    try {
      const pointType = type ? (type as PointType) : undefined;
      const points = await this.getPointsUseCase.execute({
        type: pointType,
        includeExpired: false,
      });

      return points.map(point => PointMapper.toResponse(point));
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get(':id')
  async getPointById(@Param('id') id: string) {
    try {
      const point = await this.getPointsUseCase.getById(id);
      
      if (!point) {
        return { error: 'Point not found' };
      }

      return PointMapper.toResponse(point);
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('nearby/:lat/:lng')
  async getNearbyPoints(
    @Param('lat') lat: string,
    @Param('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('type') type?: string,
  ) {
    try {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = radius ? parseFloat(radius) : 10;
      const pointType = type ? (type as PointType) : undefined;

      const points = await this.getPointsUseCase.getNearbyPoints(
        latitude,
        longitude,
        radiusKm,
        pointType,
      );

      return points.map(point => PointMapper.toResponse(point));
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post()
  @UseGuards(AuthGuard)
  @RequireAuth()
  async createPoint(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreatePointDtoSchema)) dto: CreatePointDto,
  ) {
    try {
      const point = await this.createPointUseCase.execute(dto, req.user.userId);
      return PointMapper.toResponse(point);
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('moderation/pending')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.MODERATOR)
  async getPendingModeration() {
    try {
      const points = await this.getPointsUseCase.getPendingModeration();
      return points.map(point => PointMapper.toResponse(point));
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.MODERATOR)
  async approvePoint(@Param('id') id: string) {
    try {
      const point = await this.approvePointUseCase.execute(id);
      return PointMapper.toResponse(point);
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.MODERATOR)
  async rejectPoint(@Param('id') id: string) {
    try {
      const point = await this.approvePointUseCase.reject(id);
      return PointMapper.toResponse(point);
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post(':id/resolve')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async resolvePoint(@Param('id') id: string) {
    try {
      const point = await this.approvePointUseCase.resolve(id);
      return PointMapper.toResponse(point);
    } catch (error) {
      return { error: error.message };
    }
  }
}