import { Injectable } from '@nestjs/common';
import { PointRepository } from '../interfaces/point.repository.interface';
import { Point } from '../../domain/entities/point.entity';
import { PointType } from '../../../../shared/domain/enums';

@Injectable()
export class GetPointsUseCase {
  constructor(private readonly pointRepository: PointRepository) {}

  async execute(filters?: {
    type?: PointType;
    includeExpired?: boolean;
  }): Promise<Point[]> {
    let points: Point[];

    if (filters?.type) {
      // If a specific type is requested, get points of that type
      points = await this.pointRepository.findByType(filters.type);
    } else {
      // Otherwise, get all public points
      points = await this.pointRepository.findPublicPoints();
    }

    // Filter expired points if requested
    if (!filters?.includeExpired) {
      points = points.filter(point => !point.isExpired());
    }

    return points;
  }

  async getById(id: string): Promise<Point | null> {
    const point = await this.pointRepository.findById(id);
    
    if (!point) {
      return null;
    }

    // Check if the point should be visible
    if (!point.isPublic()) {
      return null;
    }

    // Check if expired
    if (point.isExpired()) {
      return null;
    }

    return point;
  }

  async getPendingModeration(): Promise<Point[]> {
    return this.pointRepository.findPendingModeration();
  }

  async getNearbyPoints(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    type?: PointType,
  ): Promise<Point[]> {
    // Get points near the location
    let points = await this.pointRepository.findByLocation(latitude, longitude, radiusKm);

    // Filter by type if specified
    if (type) {
      points = points.filter(point => point.type === type);
    }

    // Only return public points
    return points.filter(point => point.isPublic() && !point.isExpired());
  }
}