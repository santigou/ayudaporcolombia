import { Point } from '../../domain/entities/point.entity';
import { PointResponseDto } from '../../application/dto/point-response.dto';

export class PointMapper {
  static toResponse(point: Point): Partial<PointResponseDto> {
    const plainPoint = point.toPlainObject();
    
    return {
      id: plainPoint.id,
      type: plainPoint.type,
      title: plainPoint.title,
      description: plainPoint.description,
      helpTypeId: plainPoint.helpTypeId,
      status: plainPoint.status,
      verificationStatus: plainPoint.verificationStatus,
      createdById: plainPoint.createdById,
      createdAt: plainPoint.createdAt,
      updatedAt: plainPoint.updatedAt,
      expiresAt: plainPoint.expiresAt,
      // Note: In a complete implementation, these would be populated with the full data
      locations: [],
      contacts: [],
    };
  }

  static toPlainObject(point: Point) {
    return point.toPlainObject();
  }
}