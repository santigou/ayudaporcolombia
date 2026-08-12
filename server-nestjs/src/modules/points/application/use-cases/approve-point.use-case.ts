import { Injectable } from '@nestjs/common';
import { PointRepository } from '../interfaces/point.repository.interface';
import { Point } from '../../domain/entities/point.entity';
import { VerificationStatus } from '../../../../shared/domain/enums';

@Injectable()
export class ApprovePointUseCase {
  constructor(private readonly pointRepository: PointRepository) {}

  async execute(pointId: string): Promise<Point> {
    const point = await this.pointRepository.findById(pointId);
    
    if (!point) {
      throw new Error('Point not found');
    }

    try {
      point.approve();
    } catch (error) {
      throw new Error(error.message);
    }

    return this.pointRepository.save(point);
  }

  async reject(pointId: string): Promise<Point> {
    const point = await this.pointRepository.findById(pointId);
    
    if (!point) {
      throw new Error('Point not found');
    }

    try {
      point.reject();
    } catch (error) {
      throw new Error(error.message);
    }

    return this.pointRepository.save(point);
  }

  async resolve(pointId: string): Promise<Point> {
    const point = await this.pointRepository.findById(pointId);
    
    if (!point) {
      throw new Error('Point not found');
    }

    try {
      point.resolve();
    } catch (error) {
      throw new Error(error.message);
    }

    return this.pointRepository.save(point);
  }
}