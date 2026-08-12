import { Injectable } from '@nestjs/common';
import { Point } from '../../domain/entities/point.entity';
import { PointRepository } from '../interfaces/point.repository.interface';
import { CreatePointDto } from '../dto/create-point.dto';
import { PointVerificationService } from '../../domain/services/point-verification.service';
import { PointType } from '../../../../shared/domain/enums';

@Injectable()
export class CreatePointUseCase {
  constructor(private readonly pointRepository: PointRepository) {}

  async execute(dto: CreatePointDto, userId?: string): Promise<Point> {
    // Determine initial status based on point type
    const initialStatus = PointVerificationService.determineInitialStatus(dto.type);
    const initialVerificationStatus = PointVerificationService.determineInitialVerificationStatus(dto.type);

    // Calculate expiry date
    const expiresAt = PointVerificationService.calculateExpiryDate(dto.type);

    // Create the point entity
    const point = Point.create({
      id: crypto.randomUUID(),
      type: dto.type,
      title: dto.title.trim(),
      description: dto.description.trim(),
      helpTypeId: dto.helpTypeId,
      status: initialStatus,
      verificationStatus: initialVerificationStatus,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : expiresAt,
    });

    // For now, we'll just save the point
    // In a complete implementation, we'd also handle locations, contacts, supplies, and attachments
    const savedPoint = await this.pointRepository.save(point);

    return savedPoint;
  }
}