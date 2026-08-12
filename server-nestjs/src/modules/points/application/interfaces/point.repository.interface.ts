import { Repository } from '../../../../shared/domain/base/entity.base';
import { Point } from '../../domain/entities/point.entity';
import { PointType, PointStatus, VerificationStatus } from '../../../../shared/domain/enums';

export interface PointRepository extends Repository<Point> {
  findByType(type: PointType): Promise<Point[]>;
  findByStatus(status: PointStatus): Promise<Point[]>;
  findByTypeAndStatus(type: PointType, status: PointStatus): Promise<Point[]>;
  findByVerificationStatus(status: VerificationStatus): Promise<Point[]>;
  findPublicPoints(type?: PointType): Promise<Point[]>;
  findPendingModeration(): Promise<Point[]>;
  findByCreatorId(creatorId: string): Promise<Point[]>;
  findByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<Point[]>;
}